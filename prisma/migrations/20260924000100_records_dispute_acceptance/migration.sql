BEGIN;

CREATE OR REPLACE FUNCTION public.records_submit(p_actor TEXT, p_tenancy TEXT, p_id TEXT, p_revision INTEGER, p_kind TEXT, p_payload JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
 v_role TEXT; v_revision INTEGER; v_existing public."RecordsActionEvent"%ROWTYPE;
 v_refund TEXT; v_refund_status TEXT; v_deduction_status TEXT; v_target TEXT;
 v_response_dispute TEXT; v_deduction TEXT; v_remaining INTEGER;
BEGIN
 IF p_tenancy NOT IN ('fixture-a-tenancy','fixture-b-tenancy') OR p_actor NOT IN ('fixture-a-tenant','fixture-a-landlord','fixture-b-tenant','fixture-b-landlord') THEN
   RAISE EXCEPTION 'TENANCY_UNAVAILABLE';
 END IF;
 SELECT u.role::TEXT INTO v_role FROM public."User" u
 JOIN public."Tenancy" t ON t.id=p_tenancy JOIN public."Room" r ON r.id=t."roomId" JOIN public."Property" p ON p.id=r."propertyId"
 WHERE u.id=p_actor AND NOT u."isSuspended" AND u."deletedAt" IS NULL
 AND ((u.role::TEXT='TENANT' AND t."tenantId"=u.id) OR (u.role::TEXT='LANDLORD' AND p."landlordId"=u.id));
 IF v_role IS NULL THEN RAISE EXCEPTION 'TENANCY_UNAVAILABLE'; END IF;
 IF p_id IS NULL OR p_id !~ '^[a-f0-9-]{36}$' OR p_kind IS NULL OR p_kind NOT IN ('REPORT','DISPUTE','RESPONSE','ACCEPTANCE') OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object'
 OR jsonb_typeof(p_payload->'text') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'text')) NOT BETWEEN 10 AND 2000 THEN RAISE EXCEPTION 'INVALID_SUBMISSION'; END IF;
 INSERT INTO public."RecordsRevision"("tenancyId") VALUES(p_tenancy) ON CONFLICT DO NOTHING;
 SELECT revision INTO v_revision FROM public."RecordsRevision" WHERE "tenancyId"=p_tenancy FOR UPDATE;
 SELECT * INTO v_existing FROM public."RecordsActionEvent" WHERE id=p_id;
 IF FOUND THEN
   IF v_existing."actorId"<>p_actor OR v_existing."tenancyId"<>p_tenancy OR v_existing.kind<>p_kind OR v_existing.payload<>p_payload THEN RAISE EXCEPTION 'REPLAY_MISMATCH'; END IF;
   RETURN jsonb_build_object('id',p_id,'revision',v_existing.revision,'replayed',true);
 END IF;
 IF p_revision IS NULL OR p_revision<>v_revision THEN RAISE EXCEPTION 'STALE_REVISION'; END IF;
 IF p_kind='REPORT' THEN
   IF p_payload - ARRAY['text','reportType'] <> '{}'::JSONB OR (p_payload->>'reportType') IS NULL OR (p_payload->>'reportType') NOT IN ('MOVE_IN','MOVE_OUT','INSPECTION') THEN RAISE EXCEPTION 'INVALID_SUBMISSION'; END IF;
   INSERT INTO public."ConditionReport"(id,type,notes,status,"submittedAt","createdAt","updatedAt","tenancyId","createdById")
   VALUES('submitted-'||p_id,(p_payload->>'reportType')::public."ReportType",p_payload->>'text','SUBMITTED',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,p_tenancy,p_actor);
 ELSIF p_kind='DISPUTE' THEN
   IF v_role<>'TENANT' THEN RAISE EXCEPTION 'ROLE_DENIED'; END IF;
   IF p_payload - ARRAY['text','deductionId'] <> '{}'::JSONB THEN RAISE EXCEPTION 'INVALID_SUBMISSION'; END IF;
   SELECT f.id,f.status::TEXT,d.status::TEXT INTO v_refund,v_refund_status,v_deduction_status
     FROM public."DepositRefund" f JOIN public."DepositDeduction" d ON d."refundId"=f.id
     WHERE f."tenancyId"=p_tenancy AND d.id=p_payload->>'deductionId' FOR UPDATE OF f,d;
   IF v_refund IS NULL OR v_refund_status NOT IN ('PROPOSED','IN_REVIEW','DISPUTED') OR v_deduction_status<>'PROPOSED' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
   UPDATE public."DepositDeduction" SET status='DISPUTED',"tenantDisputeNote"=p_payload->>'text',"updatedAt"=CURRENT_TIMESTAMP WHERE id=p_payload->>'deductionId';
   UPDATE public."DepositRefund" SET status='DISPUTED',"updatedAt"=CURRENT_TIMESTAMP WHERE id=v_refund;
 ELSIF p_kind='RESPONSE' THEN
   IF v_role<>'LANDLORD' THEN RAISE EXCEPTION 'ROLE_DENIED'; END IF;
   IF p_payload - ARRAY['text','disputeId'] <> '{}'::JSONB THEN RAISE EXCEPTION 'INVALID_SUBMISSION'; END IF;
   SELECT id INTO v_target FROM public."RecordsActionEvent" WHERE id=p_payload->>'disputeId' AND "tenancyId"=p_tenancy AND kind='DISPUTE';
   IF v_target IS NULL THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
 ELSIF p_kind='ACCEPTANCE' THEN
   IF v_role<>'TENANT' THEN RAISE EXCEPTION 'ROLE_DENIED'; END IF;
   IF p_payload - ARRAY['text','responseId'] <> '{}'::JSONB OR p_payload->>'text'<>'I accept this landlord response.' THEN RAISE EXCEPTION 'INVALID_SUBMISSION'; END IF;
   SELECT response.payload->>'disputeId', dispute.payload->>'deductionId'
     INTO v_response_dispute,v_deduction
     FROM public."RecordsActionEvent" response
     JOIN public."RecordsActionEvent" dispute ON dispute.id=response.payload->>'disputeId'
     WHERE response.id=p_payload->>'responseId' AND response."tenancyId"=p_tenancy AND response.kind='RESPONSE'
       AND response."actorId" IN ('fixture-a-landlord','fixture-b-landlord') AND dispute.kind='DISPUTE' AND dispute."tenancyId"=p_tenancy;
   IF v_response_dispute IS NULL OR EXISTS(SELECT 1 FROM public."RecordsActionEvent" WHERE kind='ACCEPTANCE' AND payload->>'responseId'=p_payload->>'responseId') THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
   SELECT f.id INTO v_refund FROM public."DepositRefund" f JOIN public."DepositDeduction" d ON d."refundId"=f.id
     WHERE f."tenancyId"=p_tenancy AND d.id=v_deduction AND d.status='DISPUTED' AND f.status='DISPUTED' FOR UPDATE OF f,d;
   IF v_refund IS NULL THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
   UPDATE public."DepositDeduction" SET status='ACCEPTED',"updatedAt"=CURRENT_TIMESTAMP WHERE id=v_deduction;
   SELECT count(*) INTO v_remaining FROM public."DepositDeduction" WHERE "refundId"=v_refund AND status IN ('PROPOSED','DISPUTED');
   UPDATE public."DepositRefund" SET status=CASE WHEN v_remaining=0 THEN 'AGREED'::public."RefundStatus" ELSE 'IN_REVIEW'::public."RefundStatus" END,"updatedAt"=CURRENT_TIMESTAMP WHERE id=v_refund;
 ELSE
   RAISE EXCEPTION 'INVALID_SUBMISSION';
 END IF;
 INSERT INTO public."RecordsActionEvent"(id,"tenancyId","actorId",kind,payload,revision) VALUES(p_id,p_tenancy,p_actor,p_kind,p_payload,v_revision+1);
 UPDATE public."RecordsRevision" SET revision=v_revision+1 WHERE "tenancyId"=p_tenancy;
 RETURN jsonb_build_object('id',p_id,'revision',v_revision+1,'replayed',false);
END $$;

REVOKE ALL ON FUNCTION public.records_submit(TEXT,TEXT,TEXT,INTEGER,TEXT,JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.records_submit(TEXT,TEXT,TEXT,INTEGER,TEXT,JSONB) TO rentalease_reader;
COMMIT;
