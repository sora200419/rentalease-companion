import { v2 as cloudinary } from 'cloudinary';

// Initialise once. The SDK reads these credentials from environment variables.
// This file is server-only — never import it from any 'use client' component.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Uploads a file (as a base64 data URI or a buffer converted to base64)
// to Cloudinary under the rentalease/payments folder.
// Returns the secure URL and public_id for storage in the database.
export async function uploadPaymentProof(
  fileBuffer: Buffer,
  fileName: string,
): Promise<{ url: string; publicId: string }> {
  // Convert the raw buffer to a base64 data URI that Cloudinary accepts
  const base64 = fileBuffer.toString('base64');
  const dataUri = `data:image/jpeg;base64,${base64}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: 'rentalease/payments',
    public_id: `${Date.now()}-${fileName.replace(/\.[^/.]+$/, '')}`,
    resource_type: 'image',
    // Automatically optimise quality and format for web viewing
    transformation: [
      { quality: 'auto', fetch_format: 'auto' },
      { width: 1920, crop: 'limit' }, // cap at 1920px width — enough for proof photos
    ],
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}

// Uploads a condition report photo to Cloudinary.
// Stored in a separate folder from payment proofs so the
// Cloudinary dashboard stays organised for the landlord.
export async function uploadConditionPhoto(
  fileBuffer: Buffer,
  fileName: string,
): Promise<{ url: string; publicId: string }> {
  const base64 = fileBuffer.toString('base64');
  const dataUri = `data:image/jpeg;base64,${base64}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: 'rentalease/conditions',
    public_id: `${Date.now()}-${fileName.replace(/\.[^/.]+$/, '')}`,
    resource_type: 'image',
    transformation: [
      { quality: 'auto', fetch_format: 'auto' },
      // Higher resolution limit for condition photos — detail matters
      // when documenting scratches, stains, or damage for dispute evidence
      { width: 2048, crop: 'limit' },
    ],
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}

// Deletes a previously uploaded proof from Cloudinary.
// Called when a landlord rejects and the tenant re-uploads (optional cleanup).
export async function deletePaymentProof(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId);
}

export async function deleteConditionPhoto(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
}


// Uploads a signed agreement proof. Uses auto resource_type because the tenant
// may provide either a PDF scan or phone-captured image of the signed hard copy.
export async function uploadAgreementSignatureProof(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<{ url: string; publicId: string }> {
  const base64 = fileBuffer.toString('base64');
  const dataUri = `data:${mimeType};base64,${base64}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: 'rentalease/agreement-signature-proofs',
    public_id: `${Date.now()}-${fileName.replace(/\.[^/.]+$/, '')}`,
    resource_type: 'auto',
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}

export async function deleteAgreementSignatureProof(
  publicId: string,
): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: 'auto' });
}

// Uploads a property listing photo to Cloudinary.
export async function uploadPropertyPhoto(
  fileBuffer: Buffer,
  fileName: string,
): Promise<{ url: string; publicId: string }> {
  const base64 = fileBuffer.toString('base64');
  const dataUri = `data:image/jpeg;base64,${base64}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: 'rentalease/properties',
    public_id: `${Date.now()}-${fileName.replace(/\.[^/.]+$/, '')}`,
    resource_type: 'image',
    transformation: [
      { quality: 'auto', fetch_format: 'auto' },
      { width: 2048, crop: 'limit' },
    ],
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}

export async function deletePropertyPhoto(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId);
}

export async function uploadKycImage(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<{ url: string; publicId: string }> {
  const base64 = fileBuffer.toString('base64');
  const dataUri = `data:${mimeType};base64,${base64}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: 'rentalease/kyc',
    public_id: `${Date.now()}-${fileName.replace(/\.[^/.]+$/, '')}`,
    resource_type: 'image',
    transformation: [{ quality: 'auto', fetch_format: 'auto' }, { width: 1920, crop: 'limit' }],
  });

  return { url: result.secure_url, publicId: result.public_id };
}

export async function deleteKycImage(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
}

// Uploads deposit refund proof (same pattern as payment proof)
export async function uploadRefundProof(
  fileBuffer: Buffer,
  fileName: string,
): Promise<{ url: string; publicId: string }> {
  const base64 = fileBuffer.toString('base64');
  const dataUri = `data:image/jpeg;base64,${base64}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: 'rentalease/refund-proofs',
    public_id: `${Date.now()}-${fileName.replace(/\.[^/.]+$/, '')}`,
    resource_type: 'image',
    transformation: [
      { quality: 'auto', fetch_format: 'auto' },
      { width: 1920, crop: 'limit' },
    ],
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}
