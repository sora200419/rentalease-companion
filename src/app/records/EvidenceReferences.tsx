'use client';
import type { Records } from '@/lib/companion/records-workflow';
import { evidenceReferences } from '@/lib/companion/records-evidence';
import styles from './records.module.css';
export default function EvidenceReferences({records,ids}:{records:Records;ids:string[]}) {
 const refs=evidenceReferences(records);
 return <nav className={styles.referenceLinks} aria-label="Answer sources">{ids.map(id=>{
  const ref=refs.find(r=>r.id===id);
  return ref?<a key={id} href={ref.href}>{ref.label} ↗</a>:records.settlement?.deductions.some(d=>d.id===id)?<a key={id} href="#deduction-review">Deduction record ↗</a>:null;
 })}</nav>;
}
