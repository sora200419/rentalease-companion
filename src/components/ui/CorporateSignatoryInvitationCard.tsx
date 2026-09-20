type CorporateSignatoryInvitationCardProps = {
  companyName: string;
  authorizedSignatoryName: string;
  isCurrentUserAuthorizedSignatory: boolean;
};

export default function CorporateSignatoryInvitationCard({
  companyName,
  authorizedSignatoryName,
  isCurrentUserAuthorizedSignatory,
}: CorporateSignatoryInvitationCardProps) {
  return (
    <div className="bg-[rgba(196,154,60,0.06)] border border-[rgba(196,154,60,0.2)] rounded-xl px-5 py-4">
      <p className="text-[#C49A3C] font-semibold text-sm">
        Corporate tenancy invitation
      </p>
      <p className="text-[#C49A3C] text-xs mt-1">
        This tenancy is for {companyName}. Only the authorized signatory,
        {` ${authorizedSignatoryName}`}, can complete the legal invitation and
        agreement steps for the company.
      </p>
      <p className="text-[#C49A3C] text-xs mt-2">
        {isCurrentUserAuthorizedSignatory
          ? 'You are the recorded signatory for this tenancy. Review the invitation carefully before responding on behalf of the company.'
          : 'Your account can view this tenancy record, but only the named authorized signatory can accept or decline it.'}
      </p>
    </div>
  );
}
