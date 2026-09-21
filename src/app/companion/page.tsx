import type { Metadata } from 'next';
import CompanionDemo from './CompanionDemo';

export const metadata: Metadata = { title: 'Move-out Companion · RentalEase', description: 'A local, synthetic demonstration of evidence-led deposit review.' };
export default function CompanionPage() { return <CompanionDemo />; }
