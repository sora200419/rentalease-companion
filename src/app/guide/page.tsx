import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import styles from './guide.module.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Demo guide · RentalEase', description: 'A guided, synthetic demonstration of evidence-led deposit review.' };

export default function GuidePage() {
  const records = process.env.COMPANION_RECORDS_MODE === '1';
  if (!records && process.env.COMPANION_OFFLINE_DEMO !== '1') notFound();
  return <main className={styles.page}>
    <header className={styles.header}><a href={records ? '/records' : '/demo'}>re. <span>RentalEase Companion</span></a><span>DEMONSTRATION GUIDE</span></header>
    <div className={styles.content}>
      <p className={styles.eyebrow}>A CLEARER END TO YOUR TENANCY</p>
      <h1>From “I disagree”<br />to <em>a recorded decision.</em></h1>
      <p className={styles.lead}>Follow a disputed deposit deduction through the evidence, the conversation, and the decision each person confirms.</p>
      <div className={styles.disclosure}><strong>Alexa+ track · Simulated web experience</strong><p>This independent prototype demonstrates the intended interaction in a browser. It is not connected to Alexa+, does not use an Alexa voice service, and is not an official Amazon product.</p></div>
      <section className={styles.workspace} aria-labelledby="workspace-heading">
        <div><p className={styles.eyebrow}>YOUR CURRENT WORKSPACE</p><h2 id="workspace-heading">{records ? 'Private records, shared progress.' : 'A repeatable local walkthrough.'}</h2><p>{records
          ? 'Sign in with an assigned synthetic tenant or landlord account. Records and confirmed decisions are saved to the development database. Each account sees only its own tenancies.'
          : 'Use synthetic tenant and landlord roles to resolve three deductions. Review bundled photo pairs, reply, revise amounts, accept or reject, and withdraw. Progress stays on this local server. No database credentials are needed; role switching is not real authentication.'}</p></div>
        <a className={styles.primary} href={records ? '/records' : '/demo'}>{records ? 'Open private records →' : 'Start the independent demo →'}</a>
      </section>
      <section aria-labelledby="walkthrough-heading"><p className={styles.eyebrow}>WHAT TO LOOK FOR</p><h2 id="walkthrough-heading">Three moments that matter.</h2>
        <ol className={styles.steps}>
          <li><span>01</span><div><h3>Start with the source.</h3><p>{records ? 'Choose a tenancy and a deduction. Read the report status and compare the linked move-in and move-out images. File references lead back to authorized originals.' : 'Choose a deduction and compare the labelled move-in and move-out photos. Follow report and file citations. Start a separate missing or conflicting evidence scenario to inspect the warnings.'}</p><blockquote>“Show evidence for the second deduction.”</blockquote></div></li>
          <li><span>02</span><div><h3>Review before anything changes.</h3><p>{records ? 'For an open item, the rental conversation selects an available action. Review the exact target, message and amount in the preview. Confirm to save, or cancel to leave the record untouched.' : 'Dispute the wall and cleaning items as tenant. As landlord, reply or propose a new cleaning amount. As tenant, accept or reject it. Confirm each preview separately; typing alone never saves a decision.'}</p><blockquote>“I disagree.” → Review → Confirm or cancel</blockquote></div></li>
          <li><span>03</span><div><h3>See where the decision landed.</h3><p>{records ? 'The summary separates accepted, withdrawn and unresolved deductions. A proposed new amount stays pending until the tenant accepts it. Download a dated summary with source references and decision history.' : 'Check the updated refund figure and shared activity record, then refresh. Saved progress remains; unconfirmed previews are discarded.'}</p><blockquote>An agreed settlement is not a completed payment.</blockquote></div></li>
        </ol>
      </section>
      {records && <aside className={styles.retained}><h2>A saved case, not a fresh dispute.</h2><p>The current three-item test case has already been resolved: repainting was withdrawn, cleaning was accepted at MYR 20.00, and the key deduction was accepted at MYR 25.00. The recorded refund is MYR 1,755.00.</p><p>Review its retained history and four labelled demonstration photos. Closed items intentionally do not offer new dispute decisions. The separate local companion workspace provides a repeatable action walkthrough; this page does not reset database records.</p></aside>}
      <section className={styles.limits} aria-labelledby="limits-heading"><h2 id="limits-heading">Know the boundaries.</h2><ul>
        <li>People, clauses, amounts and photos in this demonstration are synthetic. Generated photographs carry a visible demo label.</li>
        <li>Conversation routing is limited; unsupported wording may need the action menu. Optional local AI does not decide amounts or confirm actions.</li>
        {records && <li>The rental conversation uses local MCP tools to query sources and check drafts. Confirm and save remains a separate human action. This is not a live Alexa+ connection.</li>}
        <li>The records assistant quotes source text. It does not analyse image contents, decide legal liability, sign agreements, or transfer money.</li>
        <li>{records ? 'Private files require sign-in. Keep downloaded summaries private too; they contain source text.' : 'Bundled photos belong only to the synthetic local session. Do not enter real tenancy information into this demo.'}</li>
      </ul></section>
      <footer className={styles.footer}>Evidence first. Decisions by the people involved.<a href={records ? '/records' : '/demo'}>Return to the workspace ↗</a></footer>
    </div>
  </main>;
}
