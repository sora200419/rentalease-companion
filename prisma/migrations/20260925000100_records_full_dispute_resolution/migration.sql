BEGIN;
ALTER TABLE public."RecordsActionEvent" ADD COLUMN effects JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE public."RecordsActionEvent" DROP CONSTRAINT "RecordsActionEvent_kind_check";
ALTER TABLE public."RecordsActionEvent" ADD CONSTRAINT "RecordsActionEvent_kind_check"
 CHECK (kind IN ('REPORT','DISPUTE','RESPONSE','ACCEPTANCE','REJECTION','WITHDRAWAL','ADJUSTMENT','ADJUSTMENT_ACCEPTANCE','ADJUSTMENT_REJECTION','DEDUCTION_ACCEPTANCE','EVIDENCE_LINK'));

CREATE OR REPLACE FUNCTION public.records_submit(p_actor TEXT,p_tenancy TEXT,p_id TEXT,p_revision INTEGER,p_kind TEXT,p_payload JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
 v_role TEXT; v_revision INTEGER; v_existing public."RecordsActionEvent"%ROWTYPE;
 v_event public."RecordsActionEvent"%ROWTYPE; v_deduction TEXT; v_dispute TEXT;
 v_refund public."DepositRefund"%ROWTYPE; v_item public."DepositDeduction"%ROWTYPE;
 v_amount NUMERIC; v_total NUMERIC; v_effects JSONB := '{}'::JSONB; v_fields TEXT[];
BEGIN
 IF p_tenancy IS NULL OR p_actor IS NULL OR p_tenancy NOT IN ('fixture-a-tenancy','fixture-b-tenancy')
 OR p_actor NOT IN ('fixture-a-tenant','fixture-a-landlord','fixture-b-tenant','fixture-b-landlord') THEN RAISE EXCEPTION 'TENANCY_UNAVAILABLE'; END IF;
 SELECT u.role::TEXT INTO v_role FROM public."User" u
 JOIN public."Tenancy" t ON t.id=p_tenancy JOIN public."Room" r ON r.id=t."roomId" JOIN public."Property" p ON p.id=r."propertyId"
 WHERE u.id=p_actor AND NOT u."isSuspended" AND u."deletedAt" IS NULL
 AND ((u.role::TEXT='TENANT' AND t."tenantId"=u.id) OR (u.role::TEXT='LANDLORD' AND p."landlordId"=u.id));
 IF v_role IS NULL THEN RAISE EXCEPTION 'TENANCY_UNAVAILABLE'; END IF;
 v_fields := CASE p_kind
  WHEN 'REPORT' THEN ARRAY['text','reportType']
  WHEN 'DISPUTE' THEN ARRAY['text','deductionId']
  WHEN 'DEDUCTION_ACCEPTANCE' THEN ARRAY['text','deductionId']
  WHEN 'WITHDRAWAL' THEN ARRAY['text','deductionId']
  WHEN 'RESPONSE' THEN ARRAY['text','disputeId']
  WHEN 'ACCEPTANCE' THEN ARRAY['text','responseId']
  WHEN 'REJECTION' THEN ARRAY['text','responseId']
  WHEN 'ADJUSTMENT' THEN ARRAY['text','deductionId','amountSen']
  WHEN 'ADJUSTMENT_ACCEPTANCE' THEN ARRAY['text','adjustmentId']
  WHEN 'ADJUSTMENT_REJECTION' THEN ARRAY['text','adjustmentId']
  WHEN 'EVIDENCE_LINK' THEN ARRAY['text','deductionId','reportId','fileKey'] END;
 IF v_fields IS NULL OR p_id IS NULL OR p_id !~ '^[a-f0-9-]{36}$' OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object'
 OR p_payload-v_fields<>'{}'::JSONB OR NOT p_payload ?& v_fields
 OR jsonb_typeof(p_payload->'text') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'text')) NOT BETWEEN 10 AND 2000
 THEN RAISE EXCEPTION 'INVALID_SUBMISSION'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(v_fields) f WHERE f LIKE '%Id' AND (jsonb_typeof(p_payload->f) IS DISTINCT FROM 'string' OR p_payload->>f !~ '^[a-zA-Z0-9_-]{1,100}$')) THEN RAISE EXCEPTION 'INVALID_SUBMISSION'; END IF;
 INSERT INTO public."RecordsRevision"("tenancyId") VALUES(p_tenancy) ON CONFLICT DO NOTHING;
 SELECT revision INTO v_revision FROM public."RecordsRevision" WHERE "tenancyId"=p_tenancy FOR UPDATE;
 SELECT * INTO v_existing FROM public."RecordsActionEvent" WHERE id=p_id;
 IF FOUND THEN
  IF v_existing."actorId"<>p_actor OR v_existing."tenancyId"<>p_tenancy OR v_existing.kind<>p_kind OR v_existing.payload<>p_payload THEN RAISE EXCEPTION 'REPLAY_MISMATCH'; END IF;
  RETURN jsonb_build_object('id',p_id,'revision',v_existing.revision,'replayed',true);
 END IF;
 IF p_revision IS NULL OR p_revision<>v_revision THEN RAISE EXCEPTION 'STALE_REVISION'; END IF;

 IF p_kind='REPORT' THEN
  IF jsonb_typeof(p_payload->'reportType') IS DISTINCT FROM 'string' OR p_payload->>'reportType' NOT IN ('MOVE_IN','MOVE_OUT','INSPECTION') THEN RAISE EXCEPTION 'INVALID_SUBMISSION'; END IF;
  INSERT INTO public."ConditionReport"(id,type,notes,status,"submittedAt","createdAt","updatedAt","tenancyId","createdById")
  VALUES('submitted-'||p_id,(p_payload->>'reportType')::public."ReportType",p_payload->>'text','SUBMITTED',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,p_tenancy,p_actor);
 ELSE
  IF p_kind IN ('RESPONSE','ACCEPTANCE','REJECTION','ADJUSTMENT_ACCEPTANCE','ADJUSTMENT_REJECTION') THEN
   SELECT * INTO v_event FROM public."RecordsActionEvent" WHERE "tenancyId"=p_tenancy AND id=COALESCE(p_payload->>'disputeId',p_payload->>'responseId',p_payload->>'adjustmentId');
   IF v_event.id IS NULL THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
   IF p_kind='RESPONSE' THEN
    IF v_role<>'LANDLORD' OR v_event.kind<>'DISPUTE' THEN RAISE EXCEPTION 'ROLE_DENIED'; END IF;
    v_deduction := v_event.payload->>'deductionId';
   ELSIF p_kind IN ('ACCEPTANCE','REJECTION') THEN
    IF v_role<>'TENANT' OR v_event.kind<>'RESPONSE' THEN RAISE EXCEPTION 'ROLE_DENIED'; END IF;
    v_dispute := v_event.payload->>'disputeId';
    SELECT payload->>'deductionId' INTO v_deduction FROM public."RecordsActionEvent" WHERE "tenancyId"=p_tenancy AND kind='DISPUTE' AND id=v_dispute;
    IF EXISTS(SELECT 1 FROM public."RecordsActionEvent" WHERE "tenancyId"=p_tenancy AND ((kind='RESPONSE' AND payload->>'disputeId'=v_dispute AND revision>v_event.revision) OR (kind IN ('ACCEPTANCE','REJECTION') AND payload->>'responseId'=v_event.id))) THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
   ELSE
    IF v_role<>'TENANT' OR v_event.kind<>'ADJUSTMENT' THEN RAISE EXCEPTION 'ROLE_DENIED'; END IF;
    v_deduction := v_event.payload->>'deductionId';
    IF EXISTS(SELECT 1 FROM public."RecordsActionEvent" WHERE "tenancyId"=p_tenancy AND ((kind='ADJUSTMENT' AND payload->>'deductionId'=v_deduction AND revision>v_event.revision) OR (kind IN ('ADJUSTMENT_ACCEPTANCE','ADJUSTMENT_REJECTION') AND payload->>'adjustmentId'=v_event.id))) THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
   END IF;
  ELSE v_deduction := p_payload->>'deductionId';
  END IF;
  SELECT * INTO v_refund FROM public."DepositRefund" WHERE "tenancyId"=p_tenancy FOR UPDATE;
  SELECT * INTO v_item FROM public."DepositDeduction" WHERE "refundId"=v_refund.id AND id=v_deduction FOR UPDATE;
  IF v_refund.id IS NULL OR v_item.id IS NULL THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  IF p_kind='EVIDENCE_LINK' THEN
   IF jsonb_typeof(p_payload->'fileKey') IS DISTINCT FROM 'string' OR p_payload->>'fileKey' !~ '^fixture-[ab]-(tenant|landlord)--[a-f0-9]{64}--[a-zA-Z0-9_-]{1,70}\.(png|jpg|pdf)$'
    OR NOT EXISTS(SELECT 1 FROM public."ConditionReport" WHERE id=p_payload->>'reportId' AND "tenancyId"=p_tenancy AND status::TEXT IN ('SUBMITTED','PENDING_REVIEW','CORRECTION_REQUESTED','COUNTER_EVIDENCE_ADDED','ACCEPTED','DISPUTED','LOCKED'))
    OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='rentalease-evidence-dev' AND name=p_tenancy||'/'||(p_payload->>'reportId')||'/'||(p_payload->>'fileKey'))
    OR EXISTS(SELECT 1 FROM public."RecordsActionEvent" WHERE "tenancyId"=p_tenancy AND kind='EVIDENCE_LINK' AND payload->>'deductionId'=v_item.id AND payload->>'reportId'=p_payload->>'reportId' AND payload->>'fileKey'=p_payload->>'fileKey')
    THEN RAISE EXCEPTION 'INVALID_SUBMISSION'; END IF;
  ELSE
   IF v_refund.status::TEXT NOT IN ('PROPOSED','IN_REVIEW','DISPUTED') THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
   IF p_kind IN ('DISPUTE','DEDUCTION_ACCEPTANCE') THEN
    IF v_role<>'TENANT' OR v_item.status<>'PROPOSED' THEN RAISE EXCEPTION 'ROLE_DENIED'; END IF;
   ELSIF p_kind='WITHDRAWAL' THEN
    IF v_role<>'LANDLORD' OR v_item.status::TEXT NOT IN ('PROPOSED','DISPUTED') THEN RAISE EXCEPTION 'ROLE_DENIED'; END IF;
   ELSE
    IF v_item.status<>'DISPUTED' OR v_refund.status<>'DISPUTED' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
   END IF;
   IF p_kind='ADJUSTMENT' AND (v_role<>'LANDLORD' OR NOT EXISTS(SELECT 1 FROM public."RecordsActionEvent" WHERE "tenancyId"=p_tenancy AND kind='DISPUTE' AND payload->>'deductionId'=v_item.id)) THEN RAISE EXCEPTION 'ROLE_DENIED'; END IF;
   IF p_kind='ACCEPTANCE' AND (p_payload->>'text'<>'I accept this landlord response.' OR EXISTS(
     SELECT 1 FROM public."RecordsActionEvent" a WHERE a."tenancyId"=p_tenancy AND a.kind='ADJUSTMENT' AND a.payload->>'deductionId'=v_item.id
     AND NOT EXISTS(SELECT 1 FROM public."RecordsActionEvent" n WHERE n."tenancyId"=p_tenancy AND n.kind='ADJUSTMENT' AND n.payload->>'deductionId'=v_item.id AND n.revision>a.revision)
     AND NOT EXISTS(SELECT 1 FROM public."RecordsActionEvent" decision WHERE decision."tenancyId"=p_tenancy AND decision.kind IN ('ADJUSTMENT_ACCEPTANCE','ADJUSTMENT_REJECTION') AND decision.payload->>'adjustmentId'=a.id)
   )) THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
   IF p_kind='DEDUCTION_ACCEPTANCE' AND p_payload->>'text'<>'I accept this recorded deduction.' THEN RAISE EXCEPTION 'INVALID_SUBMISSION'; END IF;
   IF p_kind='ADJUSTMENT_ACCEPTANCE' AND p_payload->>'text'<>'I accept this proposed deduction amount.' THEN RAISE EXCEPTION 'INVALID_SUBMISSION'; END IF;
   IF p_kind='ADJUSTMENT' THEN
    IF jsonb_typeof(p_payload->'amountSen') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'INVALID_SUBMISSION'; END IF;
    v_amount := (p_payload->>'amountSen')::NUMERIC;
    IF v_amount<1 OR v_amount<>trunc(v_amount) OR v_amount>9999999999 OR v_amount=v_item.amount*100 THEN RAISE EXCEPTION 'INVALID_SUBMISSION'; END IF;
    v_amount := v_amount/100;
   ELSIF p_kind='ADJUSTMENT_ACCEPTANCE' THEN v_amount := (v_event.payload->>'amountSen')::NUMERIC/100;
   ELSIF p_kind='WITHDRAWAL' THEN v_amount := 0;
   ELSE v_amount := v_item.amount;
   END IF;
   SELECT COALESCE(SUM(amount),0) INTO v_total FROM public."DepositDeduction" WHERE "refundId"=v_refund.id AND status<>'WITHDRAWN';
   IF p_kind IN ('ADJUSTMENT','ADJUSTMENT_ACCEPTANCE','WITHDRAWAL') THEN
    IF v_refund."refundAmount"<>v_refund."originalAmount"-v_total OR v_total-v_item.amount+v_amount>v_refund."originalAmount" OR v_amount<0 THEN RAISE EXCEPTION 'AMOUNT_MISMATCH'; END IF;
   END IF;
   v_effects := jsonb_build_object('deductionId',v_item.id,'beforeAmountSen',v_item.amount*100,'beforeRefundSen',v_refund."refundAmount"*100);
   IF p_kind='DISPUTE' THEN
    UPDATE public."DepositDeduction" SET status='DISPUTED',"tenantDisputeNote"=p_payload->>'text',"updatedAt"=CURRENT_TIMESTAMP WHERE id=v_item.id;
   ELSIF p_kind='WITHDRAWAL' THEN
    UPDATE public."DepositDeduction" SET status='WITHDRAWN',"updatedAt"=CURRENT_TIMESTAMP WHERE id=v_item.id;
   ELSIF p_kind IN ('ACCEPTANCE','DEDUCTION_ACCEPTANCE','ADJUSTMENT_ACCEPTANCE') THEN
    UPDATE public."DepositDeduction" SET amount=v_amount,status='ACCEPTED',"updatedAt"=CURRENT_TIMESTAMP WHERE id=v_item.id;
   END IF;
   IF p_kind IN ('DISPUTE','WITHDRAWAL','ACCEPTANCE','DEDUCTION_ACCEPTANCE','ADJUSTMENT_ACCEPTANCE') THEN
    UPDATE public."DepositRefund" SET
     "refundAmount"=CASE WHEN p_kind IN ('WITHDRAWAL','ADJUSTMENT_ACCEPTANCE') THEN "originalAmount"-(SELECT COALESCE(SUM(amount),0) FROM public."DepositDeduction" WHERE "refundId"=v_refund.id AND status<>'WITHDRAWN') ELSE "refundAmount" END,
     status=CASE WHEN EXISTS(SELECT 1 FROM public."DepositDeduction" WHERE "refundId"=v_refund.id AND status='DISPUTED') THEN 'DISPUTED'::public."RefundStatus"
      WHEN EXISTS(SELECT 1 FROM public."DepositDeduction" WHERE "refundId"=v_refund.id AND status='PROPOSED') THEN 'IN_REVIEW'::public."RefundStatus"
      ELSE 'AGREED'::public."RefundStatus" END,"updatedAt"=CURRENT_TIMESTAMP WHERE id=v_refund.id;
   END IF;
   v_effects := v_effects || jsonb_build_object('afterAmountSen',CASE WHEN p_kind='WITHDRAWAL' THEN 0 WHEN p_kind='ADJUSTMENT_ACCEPTANCE' THEN v_amount*100 ELSE v_item.amount*100 END,
    'afterRefundSen',(SELECT "refundAmount"*100 FROM public."DepositRefund" WHERE id=v_refund.id));
  END IF;
 END IF;
 INSERT INTO public."RecordsActionEvent"(id,"tenancyId","actorId",kind,payload,effects,revision) VALUES(p_id,p_tenancy,p_actor,p_kind,p_payload,v_effects,v_revision+1);
 UPDATE public."RecordsRevision" SET revision=v_revision+1 WHERE "tenancyId"=p_tenancy;
 RETURN jsonb_build_object('id',p_id,'revision',v_revision+1,'replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.records_submit(TEXT,TEXT,TEXT,INTEGER,TEXT,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.records_submit(TEXT,TEXT,TEXT,INTEGER,TEXT,JSONB) TO rentalease_reader;
COMMIT;
