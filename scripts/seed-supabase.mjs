import { PrismaClient } from '@prisma/client';
import { loadDevelopmentDatabaseUrl } from './supabase-config.mjs';
let db;
try {
  db = new PrismaClient({ datasources: { db: { url: loadDevelopmentDatabaseUrl() } }, log: [] });
  await db.$transaction(async tx => {
    // Additive, repeatable fixtures. Never overwrite existing rows or usable passwords.
    for (const key of ['a', 'b']) {
      const landlord = `fixture-${key}-landlord`, tenant = `fixture-${key}-tenant`;
      for (const [id, role] of [[landlord, 'LANDLORD'], [tenant, 'TENANT']]) {
        await tx.user.upsert({ where: { id }, update: {}, create: { id, role, name: `Synthetic ${id}`, email: `${id}@example.invalid`, password: '!disabled-fixture-login!' } });
      }
      await tx.property.upsert({ where: { id: `fixture-${key}-property` }, update: {}, create: { id: `fixture-${key}-property`, landlordId: landlord, address: 'Synthetic address', city: 'Demo city', state: 'Demo state', postcode: '00000', type: 'Apartment' } });
      await tx.room.upsert({ where: { id: `fixture-${key}-room` }, update: {}, create: { id: `fixture-${key}-room`, propertyId: `fixture-${key}-property`, label: 'Synthetic room', roomType: 'ENTIRE_UNIT', bathroomType: 'ATTACHED', furnishing: 'UNFURNISHED', rentAmount: '1200.00' } });
      await tx.tenancy.upsert({ where: { id: `fixture-${key}-tenancy` }, update: {}, create: { id: `fixture-${key}-tenancy`, tenantId: tenant, roomId: `fixture-${key}-room`, startDate: new Date('2025-10-01'), endDate: new Date('2026-09-30'), monthlyRent: '1200.00', depositAmount: key === 'a' ? '2400.00' : '1800.00', status: 'ACTIVE' } });
      for (const [suffix, type, status, notes] of [
        ['in', 'MOVE_IN', 'ACCEPTED', `Synthetic ${key}: a scuff below the window was recorded at move-in.`],
        ['out', 'MOVE_OUT', 'SUBMITTED', `Synthetic ${key}: a scuff is recorded at move-out; repainting is proposed.`],
        ['draft', 'INSPECTION', 'DRAFT', 'PRIVATE_DRAFT_NOT_FOR_ASSISTANT'],
      ]) await tx.conditionReport.upsert({ where: { id: `fixture-${key}-${suffix}` }, update: {}, create: { id: `fixture-${key}-${suffix}`, tenancyId: `fixture-${key}-tenancy`, createdById: landlord, type, status, notes, submittedAt: status === 'DRAFT' ? null : new Date('2026-09-20') } });
      await tx.agreement.upsert({ where: { tenancyId: `fixture-${key}-tenancy` }, update: {}, create: { id: `fixture-${key}-agreement`, tenancyId: `fixture-${key}-tenancy`, rawContent: 'Synthetic clause: review supporting evidence and consider pre-existing marks.', plainLanguageSummary: 'Not used as authoritative evidence.', status: 'FINALIZED' } });
      await tx.depositRefund.upsert({ where: { tenancyId: `fixture-${key}-tenancy` }, update: {}, create: { id: `fixture-${key}-refund`, tenancyId: `fixture-${key}-tenancy`, originalAmount: key === 'a' ? '2400' : '1800', refundAmount: key === 'a' ? '2100' : '1700', status: 'PROPOSED' } });
      await tx.depositDeduction.upsert({ where: { id: `fixture-${key}-deduction` }, update: {}, create: { id: `fixture-${key}-deduction`, refundId: `fixture-${key}-refund`, reason: 'Synthetic repainting proposal', amount: key === 'a' ? '300' : '100', photoIds: '[]', status: 'PROPOSED' } });
    }
  }, { timeout: 60000 });
  console.log('Synthetic fixtures ready: two separate tenancies, four non-login fixture users. No real personal data imported.');
} catch { console.error('Fixture setup failed; credentials and raw database errors suppressed.'); process.exitCode = 1; }
finally { if (db) await db.$disconnect(); }
