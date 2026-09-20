export type CorporateOccupantDraft = {
  name: string;
  icNumber?: string;
  phone?: string;
  roleLabel?: string;
};

export type NormalizedCorporateOccupant = {
  name: string;
  icNumber: string | null;
  phone: string | null;
  roleLabel: string | null;
};

export type CorporateTenancyCreateInput = {
  roomId: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  depositAmount: number;
  companyName: string;
  companyRegistrationNo?: string;
  authorizedSignatoryName: string;
  authorizedSignatoryIC?: string;
  authorizedSignatoryRole?: string;
  authorizedSignatoryEmail?: string;
  occupants: CorporateOccupantDraft[];
};

function normalizeOptionalText(value?: string): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeAuthorizedSignatoryEmail(value?: string): string | null {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

export function normalizeCorporateOccupants(
  rows: CorporateOccupantDraft[],
): NormalizedCorporateOccupant[] {
  return rows
    .map((row) => ({
      name: row.name.trim(),
      icNumber: normalizeOptionalText(row.icNumber),
      phone: normalizeOptionalText(row.phone),
      roleLabel: normalizeOptionalText(row.roleLabel),
    }))
    .filter((row) => row.name.length > 0);
}

export function buildCorporateTenancyCreateInput(
  input: CorporateTenancyCreateInput,
) {
  return {
    roomId: input.roomId,
    leasePartyType: "CORPORATE" as const,
    startDate: input.startDate,
    endDate: input.endDate,
    monthlyRent: input.monthlyRent,
    depositAmount: input.depositAmount,
    companyName: input.companyName.trim(),
    companyRegistrationNo: normalizeOptionalText(input.companyRegistrationNo),
    authorizedSignatoryName: input.authorizedSignatoryName.trim(),
    authorizedSignatoryIC: normalizeOptionalText(input.authorizedSignatoryIC),
    authorizedSignatoryRole: normalizeOptionalText(input.authorizedSignatoryRole),
    authorizedSignatoryEmail: normalizeAuthorizedSignatoryEmail(
      input.authorizedSignatoryEmail,
    ),
    occupants: normalizeCorporateOccupants(input.occupants),
  };
}
