/*
 * Internationalization helper — minimal by design.
 *
 * Why a custom helper instead of a library like next-intl?
 * --------------------------------------------------------
 * Libraries like next-intl are designed for production applications with
 * many locales, complex pluralization rules, timezone-aware date formatting,
 * and automatic locale detection from URLs or cookies. Our needs are much
 * smaller: two languages (English and Bahasa Malaysia), roughly 200 UI
 * strings, session-based locale preference, and no URL routing changes.
 *
 * For that scale, a twenty-line dictionary lookup is simpler, has zero
 * dependencies to version-pin against Next.js, and is easy to explain in
 * the Chapter 4 write-up. If the project ever grows to need full i18n
 * features, swapping this file for next-intl is a straightforward
 * mechanical migration at that point.
 *
 * How this is used
 * ----------------
 * Server components read the user's language from the NextAuth session
 * and pass it down as a prop to any component that needs translations:
 *
 *     const session = await getServerSession(authOptions);
 *     const lang: Language = session?.user?.language ?? 'en';
 *     return <MyComponent lang={lang} />;
 *
 * The component then calls t() with the key, the language, and optionally
 * an interpolation map:
 *
 *     <h1>{t('dashboard_welcome', lang, { name: user.name })}</h1>
 *
 * Keys that are missing from the Malay dictionary fall back to English
 * automatically. Keys missing from both dictionaries fall back to the
 * key name itself — this is deliberate so that missing translations are
 * visible in the UI rather than rendering as blanks.
 */

export type Language = 'en' | 'ms';

/*
 * Message dictionaries — English and Bahasa Malaysia.
 *
 * Phase A ships this file with empty dictionaries so the helper is
 * available for import. Phase C, Step 13 will populate both dictionaries
 * with the actual UI strings. The order of key-value pairs here should
 * match the order of the corresponding entries in the other dictionary,
 * so a reviewer can diff them side by side.
 *
 * Naming convention for keys:
 *   - snake_case, lowercase
 *   - prefix with the area (nav_, dashboard_, form_, btn_, error_)
 *   - describe the content, not the location
 *     GOOD: 'nav_dashboard', 'btn_save_profile', 'error_network_retry'
 *     BAD:  'top_right_link', 'button_1', 'red_message'
 */

export const messagesEn: Record<string, string> = {
  // Navigation
  nav_dashboard: 'Dashboard',
  nav_properties: 'Properties',
  nav_tenancies: 'Tenancies',
  nav_messages: 'Messages',
  nav_my_tenancy: 'My Tenancy',
  nav_profile: 'Profile',
  nav_sign_out: 'Sign out',

  // Auth
  auth_login_title: 'Sign in to RentalEase',
  auth_login_subtitle: 'Welcome back',
  auth_register_title: 'Create your account',
  auth_email: 'Email address',
  auth_password: 'Password',
  auth_confirm_password: 'Confirm password',
  auth_name: 'Full name',
  auth_role: 'I am a',
  auth_role_landlord: 'Landlord',
  auth_role_tenant: 'Tenant',
  auth_btn_login: 'Sign in',
  auth_btn_register: 'Create account',
  auth_have_account: 'Already have an account?',
  auth_no_account: "Don't have an account?",

  // Dashboard - Landlord
  dashboard_landlord_title: 'Landlord Dashboard',
  dashboard_landlord_welcome: 'Welcome back, {name}',
  dashboard_total_properties: 'Properties',
  dashboard_active_tenancies: 'Active Tenancies',
  dashboard_pending_invitations: 'Pending Invitations',
  dashboard_under_review_payments: 'Payments Under Review',

  // Dashboard - Tenant
  dashboard_tenant_title: 'Tenant Dashboard',
  dashboard_tenant_welcome: 'Welcome back, {name}',
  dashboard_no_tenancy: 'No active tenancy',
  dashboard_no_tenancy_desc: "You don't have an active tenancy yet. Your landlord will send you an invitation.",

  // Properties
  properties_title: 'My Properties',
  properties_add: 'Add Property',
  properties_none: 'No properties yet',
  properties_none_desc: 'Add your first property to start creating tenancies.',
  property_address: 'Address',
  property_city: 'City',
  property_state: 'State',
  property_postcode: 'Postcode',
  property_type: 'Property Type',

  // Rooms
  room_add: 'Add Room',
  room_type: 'Room Type',
  room_furnishing: 'Furnishing',
  room_rent: 'Monthly Rent',
  room_deposit: 'Deposit',
  room_available: 'Available',
  room_occupied: 'Occupied',

  // Tenancies
  tenancies_title: 'Tenancies',
  tenancy_status_invited: 'Invited',
  tenancy_status_pending: 'Pending',
  tenancy_status_active: 'Active',
  tenancy_status_expired: 'Expired',
  tenancy_status_terminated: 'Terminated',
  tenancy_start: 'Start Date',
  tenancy_end: 'End Date',
  tenancy_monthly_rent: 'Monthly Rent',
  tenancy_deposit: 'Security Deposit',
  tenancy_tenant: 'Tenant',
  tenancy_landlord: 'Landlord',

  // Agreement
  agreement_title: 'Tenancy Agreement',
  agreement_status_draft: 'Draft',
  agreement_status_finalized: 'Finalized',
  agreement_status_negotiating: 'Negotiating',
  agreement_status_signed: 'Signed',
  agreement_tab_full: 'Full Agreement',
  agreement_tab_summary: 'Plain Language',
  agreement_tab_redflags: 'Red Flags',
  agreement_summary_desc: 'Each clause explained in plain language — designed for tenants and landlords without legal training.',
  agreement_redflags_desc: 'AI analysis of potential issues, ambiguities, or unfair terms in the agreement under Malaysian law.',
  agreement_no_redflags: 'No red flags detected',
  agreement_no_redflags_desc: 'The AI analysis found no significant issues with this agreement.',
  agreement_download_pdf: 'Download PDF',
  agreement_download_summary: 'Download Summary (PDF)',
  agreement_finalize: 'Finalise & Send to Tenant',
  agreement_sign: 'Accept & Sign',
  agreement_request_changes: 'Request Changes',

  // Wizard
  wizard_title: 'Agreement Wizard',
  wizard_step_of: 'Step {step} of {total}',
  wizard_btn_next: 'Next →',
  wizard_btn_back: '← Back',
  wizard_btn_complete: '✨ Complete & Generate Agreement',
  wizard_generating: 'Generating your agreement',
  wizard_generating_desc: 'This takes about 1 minute.',
  wizard_draft_in_progress: 'You have a draft in progress. Continue where you left off or adjust your answers.',

  // Payments
  payments_title: 'Rent Payments',
  payment_due: 'Due',
  payment_paid: 'Paid',
  payment_pending: 'Pending',
  payment_under_review: 'Under Review',
  payment_overdue: 'Overdue',
  payment_upload_proof: 'Upload Proof',
  payment_approve: 'Approve',
  payment_reject: 'Reject',
  payment_rejection_reason: 'Rejection reason',

  // Condition Reports
  condition_title: 'Condition Reports',
  condition_create: 'Create Report',
  condition_move_in: 'Move-In',
  condition_move_out: 'Move-Out',
  condition_inspection: 'Inspection',
  condition_acknowledge: 'Acknowledge',
  condition_acknowledged: 'Acknowledged',
  condition_photos: 'Photos',
  condition_add_photo: 'Add Photo',
  condition_notes: 'Notes',

  // Profile
  profile_title: 'My Profile',
  profile_name: 'Full Name',
  profile_email: 'Email',
  profile_phone: 'Phone Number',
  profile_ic: 'Malaysian IC Number',
  profile_ic_hint: 'Format: 901231-14-5678 or 901231145678',
  profile_language: 'Display Language',
  profile_save: 'Save Changes',
  profile_saved: 'Profile updated successfully.',
  profile_documents: 'Identity Documents',

  // Notifications
  notifications_title: 'Notifications',
  notifications_mark_all: 'Mark all read',
  notifications_empty: 'No notifications yet.',
  notifications_empty_desc: "You'll see updates about invitations, agreements, and payments here.",

  // Banners
  banner_agreement_review: '{count} agreement{s} awaiting your review',
  banner_rejected_payments: '{count} payment proof{s} rejected — please re-upload',
  banner_changes_requested: '{count} agreement{s} with tenant-requested changes',
  banner_payment_verification: '{count} payment proof{s} awaiting verification',
  banner_condition_reports: '{count} condition report{s} awaiting your acknowledgement',
  banner_tenancy_ending: 'Tenancy ending in {days} day{s}',

  // Deposit Settlement
  deposit_title: 'Deposit Settlement',
  deposit_original: 'Original Deposit',
  deposit_deductions: 'Deductions',
  deposit_refund: 'Refund Amount',
  deposit_add_deduction: 'Add Deduction',
  deposit_reason: 'Reason',
  deposit_amount: 'Amount',
  deposit_photos_required: 'Photo Evidence',
  deposit_accept: 'Accept',
  deposit_dispute: 'Dispute',
  deposit_mark_paid: 'Mark as Paid',
  deposit_upload_proof: 'Upload Payment Proof',

  // Common
  btn_save: 'Save',
  btn_cancel: 'Cancel',
  btn_delete: 'Delete',
  btn_upload: 'Upload',
  btn_retry: 'Try Again',
  btn_go_dashboard: 'Go to Dashboard',
  status_loading: 'Loading…',
  error_generic: 'Something went wrong. Please try again.',
  error_network: 'Network error. Check your connection.',
  error_not_found: 'Page not found',
  error_not_found_desc: "The page you're looking for doesn't exist or may have been moved.",
};

export const messagesMs: Record<string, string> = {
  // Navigation
  nav_dashboard: 'Papan Pemuka',
  nav_properties: 'Hartanah',
  nav_tenancies: 'Penyewaan',
  nav_messages: 'Mesej',
  nav_my_tenancy: 'Penyewaan Saya',
  nav_profile: 'Profil',
  nav_sign_out: 'Log Keluar',

  // Auth
  auth_login_title: 'Log masuk ke RentalEase',
  auth_login_subtitle: 'Selamat kembali',
  auth_register_title: 'Buat akaun anda',
  auth_email: 'Alamat e-mel',
  auth_password: 'Kata laluan',
  auth_confirm_password: 'Sahkan kata laluan',
  auth_name: 'Nama penuh',
  auth_role: 'Saya adalah',
  auth_role_landlord: 'Tuan Tanah',
  auth_role_tenant: 'Penyewa',
  auth_btn_login: 'Log masuk',
  auth_btn_register: 'Buat akaun',
  auth_have_account: 'Sudah mempunyai akaun?',
  auth_no_account: 'Belum mempunyai akaun?',

  // Dashboard - Landlord
  dashboard_landlord_title: 'Papan Pemuka Tuan Tanah',
  dashboard_landlord_welcome: 'Selamat kembali, {name}',
  dashboard_total_properties: 'Hartanah',
  dashboard_active_tenancies: 'Penyewaan Aktif',
  dashboard_pending_invitations: 'Jemputan Menunggu',
  dashboard_under_review_payments: 'Pembayaran Dalam Semakan',

  // Dashboard - Tenant
  dashboard_tenant_title: 'Papan Pemuka Penyewa',
  dashboard_tenant_welcome: 'Selamat kembali, {name}',
  dashboard_no_tenancy: 'Tiada penyewaan aktif',
  dashboard_no_tenancy_desc: 'Anda belum mempunyai penyewaan aktif. Tuan tanah anda akan menghantar jemputan.',

  // Properties
  properties_title: 'Hartanah Saya',
  properties_add: 'Tambah Hartanah',
  properties_none: 'Belum ada hartanah',
  properties_none_desc: 'Tambah hartanah pertama anda untuk mula mencipta penyewaan.',
  property_address: 'Alamat',
  property_city: 'Bandar',
  property_state: 'Negeri',
  property_postcode: 'Poskod',
  property_type: 'Jenis Hartanah',

  // Rooms
  room_add: 'Tambah Bilik',
  room_type: 'Jenis Bilik',
  room_furnishing: 'Perabot',
  room_rent: 'Sewa Bulanan',
  room_deposit: 'Deposit',
  room_available: 'Tersedia',
  room_occupied: 'Diduduki',

  // Tenancies
  tenancies_title: 'Penyewaan',
  tenancy_status_invited: 'Dijemput',
  tenancy_status_pending: 'Menunggu',
  tenancy_status_active: 'Aktif',
  tenancy_status_expired: 'Tamat Tempoh',
  tenancy_status_terminated: 'Ditamatkan',
  tenancy_start: 'Tarikh Mula',
  tenancy_end: 'Tarikh Tamat',
  tenancy_monthly_rent: 'Sewa Bulanan',
  tenancy_deposit: 'Deposit Keselamatan',
  tenancy_tenant: 'Penyewa',
  tenancy_landlord: 'Tuan Tanah',

  // Agreement
  agreement_title: 'Perjanjian Penyewaan',
  agreement_status_draft: 'Draf',
  agreement_status_finalized: 'Dimuktamadkan',
  agreement_status_negotiating: 'Dalam Rundingan',
  agreement_status_signed: 'Ditandatangani',
  agreement_tab_full: 'Perjanjian Penuh',
  agreement_tab_summary: 'Bahasa Mudah',
  agreement_tab_redflags: 'Bendera Merah',
  agreement_summary_desc: 'Setiap fasal dijelaskan dalam bahasa mudah — direka untuk penyewa dan tuan tanah tanpa latihan undang-undang.',
  agreement_redflags_desc: 'Analisis AI tentang isu-isu, kekaburan, atau terma yang tidak adil dalam perjanjian di bawah undang-undang Malaysia.',
  agreement_no_redflags: 'Tiada bendera merah dikesan',
  agreement_no_redflags_desc: 'Analisis AI tidak menemui sebarang isu ketara dengan perjanjian ini.',
  agreement_download_pdf: 'Muat Turun PDF',
  agreement_download_summary: 'Muat Turun Ringkasan (PDF)',
  agreement_finalize: 'Muktamadkan & Hantar kepada Penyewa',
  agreement_sign: 'Terima & Tandatangan',
  agreement_request_changes: 'Minta Perubahan',

  // Wizard
  wizard_title: 'Wizard Perjanjian',
  wizard_step_of: 'Langkah {step} daripada {total}',
  wizard_btn_next: 'Seterusnya →',
  wizard_btn_back: '← Kembali',
  wizard_btn_complete: '✨ Selesai & Jana Perjanjian',
  wizard_generating: 'Menjana perjanjian anda',
  wizard_generating_desc: 'Ini mengambil masa kira-kira 1 minit.',
  wizard_draft_in_progress: 'Anda mempunyai draf yang sedang dalam proses. Teruskan dari mana anda berhenti atau laraskan jawapan anda.',

  // Payments
  payments_title: 'Bayaran Sewa',
  payment_due: 'Perlu Dibayar',
  payment_paid: 'Dibayar',
  payment_pending: 'Menunggu',
  payment_under_review: 'Dalam Semakan',
  payment_overdue: 'Tertunggak',
  payment_upload_proof: 'Muat Naik Bukti',
  payment_approve: 'Luluskan',
  payment_reject: 'Tolak',
  payment_rejection_reason: 'Sebab penolakan',

  // Condition Reports
  condition_title: 'Laporan Keadaan',
  condition_create: 'Buat Laporan',
  condition_move_in: 'Masuk',
  condition_move_out: 'Keluar',
  condition_inspection: 'Pemeriksaan',
  condition_acknowledge: 'Akui',
  condition_acknowledged: 'Diakui',
  condition_photos: 'Foto',
  condition_add_photo: 'Tambah Foto',
  condition_notes: 'Nota',

  // Profile
  profile_title: 'Profil Saya',
  profile_name: 'Nama Penuh',
  profile_email: 'E-mel',
  profile_phone: 'Nombor Telefon',
  profile_ic: 'Nombor IC Malaysia',
  profile_ic_hint: 'Format: 901231-14-5678 atau 901231145678',
  profile_language: 'Bahasa Paparan',
  profile_save: 'Simpan Perubahan',
  profile_saved: 'Profil berjaya dikemas kini.',
  profile_documents: 'Dokumen Pengenalan',

  // Notifications
  notifications_title: 'Pemberitahuan',
  notifications_mark_all: 'Tandakan semua dibaca',
  notifications_empty: 'Tiada pemberitahuan lagi.',
  notifications_empty_desc: 'Anda akan melihat kemas kini tentang jemputan, perjanjian, dan pembayaran di sini.',

  // Banners
  banner_agreement_review: '{count} perjanjian menunggu semakan anda',
  banner_rejected_payments: '{count} bukti pembayaran ditolak — sila muat naik semula',
  banner_changes_requested: '{count} perjanjian dengan perubahan yang diminta penyewa',
  banner_payment_verification: '{count} bukti pembayaran menunggu pengesahan',
  banner_condition_reports: '{count} laporan keadaan menunggu pengakuan anda',
  banner_tenancy_ending: 'Penyewaan tamat dalam {days} hari',

  // Deposit Settlement
  deposit_title: 'Penyelesaian Deposit',
  deposit_original: 'Deposit Asal',
  deposit_deductions: 'Potongan',
  deposit_refund: 'Jumlah Bayaran Balik',
  deposit_add_deduction: 'Tambah Potongan',
  deposit_reason: 'Sebab',
  deposit_amount: 'Jumlah',
  deposit_photos_required: 'Bukti Foto',
  deposit_accept: 'Terima',
  deposit_dispute: 'Bantah',
  deposit_mark_paid: 'Tandakan Dibayar',
  deposit_upload_proof: 'Muat Naik Bukti Pembayaran',

  // Common
  btn_save: 'Simpan',
  btn_cancel: 'Batal',
  btn_delete: 'Padam',
  btn_upload: 'Muat Naik',
  btn_retry: 'Cuba Lagi',
  btn_go_dashboard: 'Pergi ke Papan Pemuka',
  status_loading: 'Memuatkan…',
  error_generic: 'Sesuatu tidak kena. Sila cuba lagi.',
  error_network: 'Ralat rangkaian. Semak sambungan anda.',
  error_not_found: 'Halaman tidak dijumpai',
  error_not_found_desc: 'Halaman yang anda cari tidak wujud atau mungkin telah dialihkan.',
};

/*
 * Translate a key to the given language with optional variable interpolation.
 *
 * Lookup order:
 *   1. Try the requested language's dictionary.
 *   2. If not found and language was 'ms', fall back to the English dictionary.
 *   3. If still not found, return the key itself (makes missing keys visible).
 *
 * Variable interpolation:
 *   Placeholders use the form {name} in the message string. The vars
 *   parameter is an object mapping placeholder names to their values.
 *   Missing placeholders are left as-is rather than rendered as 'undefined'.
 *
 * Examples:
 *   t('nav_dashboard', 'en')                    // "Dashboard"
 *   t('dashboard_welcome', 'en', { name: 'Sora' })
 *     with template "Welcome, {name}!"          // "Welcome, Sora!"
 *   t('missing_key', 'ms')                      // "missing_key"
 */
export function t(
  key: string,
  lang: Language,
  vars?: Record<string, string | number>,
): string {
  // Pick the right dictionary. For Malay, fall back to English if the key
  // isn't translated yet — this is common during the gradual rollout of
  // translations in Phase C.
  const dict = lang === 'ms' ? messagesMs : messagesEn;
  let template = dict[key];

  if (template === undefined && lang === 'ms') {
    template = messagesEn[key];
  }

  // If we still don't have a template, surface the missing key in the UI
  // so the developer spots it during testing instead of silently rendering
  // an empty string.
  if (template === undefined) {
    return key;
  }

  // No variables to interpolate — return the template as-is. Using this
  // fast path avoids unnecessary regex work when most strings are simple.
  if (!vars) {
    return template;
  }

  // Simple `{name}` placeholder replacement. Not regex-escaped because
  // our keys follow a controlled naming convention (alphanumeric and
  // underscore only) and user input never ends up in template strings.
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}
