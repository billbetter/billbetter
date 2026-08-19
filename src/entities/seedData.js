import { localDataEngine } from "@/api/localDataEngine";

const OWNER_USER_ID = "usr_owner_001";

const ownerUser = {
  id: OWNER_USER_ID,
  email: "james.miller@axisdemo.com",
  full_name: "James Miller",
  onboarding_completed: true,
  role: "admin",
};

const businessSettings = {
  id: "bs_001",
  user_id: OWNER_USER_ID,
  business_name: "Miller Construction & Renovations",
  email: "office@millerrenovations.com",
  phone: "+1 (555) 234-8900",
  address: "452 Industrial Blvd, Austin, TX 78744",
  website: "https://millerrenovations.com",
  timezone: "America/Chicago",
  tax_rate: 8.25,
  hourly_rate: 85,
  invoice_prefix: "INV",
  payment_terms: "Net 30",
  pdf_color_scheme: "#10b981",
  pdf_footer_text: "Thank you for choosing Miller Construction!",
  show_pdf_branding: true,
  font_family: "helvetica",
  invoice_template: "professional",
  stripe_account_status: "not_connected",
  stripe_onboarding_completed: false,
  google_calendar_connected: false,
  booking_enabled: false,
  default_appointment_duration: 60,
  booking_buffer_time: 0,
  booking_notice_time: 60,
  send_review_requests: false,
  analytics_email_frequency: "biweekly",
  analytics_email_day: 1,
  analytics_email_time: "09:00",
};

const subscription = {
  id: "sub_001",
  user_id: OWNER_USER_ID,
  plan_name: "essential",
  billing_cycle: "monthly",
  monthly_transaction_limit: 100,
  lifetime_documents_created: 24,
  transactions_used_this_month: 18,
  invoices_used_this_month: 12,
  quotes_used_this_month: 6,
  payment_processing_fee: 1,
  status: "active",
  subscription_start_date: "2024-11-01T00:00:00.000Z",
  next_billing_date: "2025-04-01T00:00:00.000Z",
  features: {
    excel_export: true,
    analytics_dashboard: true,
    receipt_checker: true,
    custom_templates: true,
    multi_user: true,
    priority_support: false,
    custom_ai_agent: false,
  },
};

const clients = [
  { id: "cl_001", user_id: OWNER_USER_ID, name: "Sarah Thompson", email: "sarah.t@thompsonhome.com", phone: "+1 (512) 334-1122", address: "1201 Maple Dr, Austin, TX 78704", notes: "Repeat client. Prefers email communication.", total_invoiced: 8450 },
  { id: "cl_002", user_id: OWNER_USER_ID, name: "Oakridge Property Management", email: "accounts@oakridgepm.com", phone: "+1 (512) 445-9988", address: "88 Corporate Park, Austin, TX 78701", notes: "Commercial account. Net 30 terms.", total_invoiced: 15200 },
  { id: "cl_003", user_id: OWNER_USER_ID, name: "David & Rachel Chen", email: "dchen@gmail.com", phone: "+1 (512) 556-7766", address: "3400 Barton Creek Blvd, Austin, TX 78735", notes: "Kitchen renovation completed Dec 2024.", total_invoiced: 18750 },
  { id: "cl_004", user_id: OWNER_USER_ID, name: "Austin Wellness Center", email: "facilities@austinwellness.com", phone: "+1 (512) 667-3344", address: "900 Wellness Way, Austin, TX 78731", notes: "Tenant improvement projects quarterly.", total_invoiced: 9200 },
  { id: "cl_005", user_id: OWNER_USER_ID, name: "Marcus Johnson", email: "mjohnson@protonmail.com", phone: "+1 (512) 778-5544", address: "555 Riverside Rd, Austin, TX 78741", notes: "Deck repair and fence installation.", total_invoiced: 4200 },
  { id: "cl_006", user_id: OWNER_USER_ID, name: "Highland Cafe LLC", email: "manager@highlandcafe.com", phone: "+1 (512) 889-2233", address: "77 Highland Ave, Austin, TX 78752", notes: "Restaurant renovation. After-hours preferred.", total_invoiced: 12800 },
  { id: "cl_007", user_id: OWNER_USER_ID, name: "Elena Rodriguez", email: "elena.r@outlook.com", phone: "+1 (512) 990-8877", address: "2100 South Congress Ave, Austin, TX 78704", notes: "Bathroom remodel + flooring.", total_invoiced: 6750 },
  { id: "cl_008", user_id: OWNER_USER_ID, name: "Beacon Hill Apartments", email: "maintenance@beaconhillapt.com", phone: "+1 (512) 101-5566", address: "400 Beacon Hill Dr, Austin, TX 78753", notes: "Multi-unit drywall and paint.", total_invoiced: 5600 },
];

const now = new Date();
const iso = (d) => d.toISOString();
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

const invoices = [
  {
    id: "inv_001", user_id: OWNER_USER_ID, invoice_number: "INV-240301", client_id: "cl_001", client_name: "Sarah Thompson", client_email: "sarah.t@thompsonhome.com", client_phone: "+1 (512) 334-1122", client_address: "1201 Maple Dr, Austin, TX 78704",
    items: [{ description: "Master bathroom tile installation", quantity: 1, rate: 3200, amount: 3200 }, { description: "Plumbing fixture replacement", quantity: 1, rate: 850, amount: 850 }],
    subtotal: 4050, tax_rate: 8.25, tax_amount: 334.13, total: 4384.13, status: "paid", due_date: iso(addDays(now, -45)), paid_date: iso(addDays(now, -42)), notes: "Paid via bank transfer.", delivery_method: "email",
  },
  {
    id: "inv_002", user_id: OWNER_USER_ID, invoice_number: "INV-240315", client_id: "cl_002", client_name: "Oakridge Property Management", client_email: "accounts@oakridgepm.com", client_phone: "+1 (512) 445-9988", client_address: "88 Corporate Park, Austin, TX 78701",
    items: [{ description: "Office lobby drywall repair", quantity: 3, rate: 450, amount: 1350 }, { description: "Paint and primer (lobby)", quantity: 1, rate: 1100, amount: 1100 }],
    subtotal: 2450, tax_rate: 8.25, tax_amount: 202.13, total: 2652.13, status: "paid", due_date: iso(addDays(now, -30)), paid_date: iso(addDays(now, -28)), notes: "", delivery_method: "email",
  },
  {
    id: "inv_003", user_id: OWNER_USER_ID, invoice_number: "INV-240401", client_id: "cl_003", client_name: "David & Rachel Chen", client_email: "dchen@gmail.com", client_phone: "+1 (512) 556-7766", client_address: "3400 Barton Creek Blvd, Austin, TX 78735",
    items: [{ description: "Custom kitchen cabinetry", quantity: 1, rate: 9500, amount: 9500 }, { description: "Quartz countertop install", quantity: 1, rate: 4200, amount: 4200 }, { description: "LED under-cabinet lighting", quantity: 1, rate: 650, amount: 650 }],
    subtotal: 14350, tax_rate: 8.25, tax_amount: 1183.88, total: 15533.88, status: "sent", due_date: iso(addDays(now, 15)), notes: "Final invoice for kitchen renovation.", delivery_method: "email",
  },
  {
    id: "inv_004", user_id: OWNER_USER_ID, invoice_number: "INV-240410", client_id: "cl_004", client_name: "Austin Wellness Center", client_email: "facilities@austinwellness.com", client_phone: "+1 (512) 667-3344", client_address: "900 Wellness Way, Austin, TX 78731",
    items: [{ description: "Reception desk build-out", quantity: 1, rate: 2800, amount: 2800 }, { description: "Flooring (LVP) install", quantity: 450, rate: 4.5, amount: 2025 }],
    subtotal: 4825, tax_rate: 8.25, tax_amount: 398.06, total: 5223.06, status: "overdue", due_date: iso(addDays(now, -10)), notes: "Please remit payment promptly.", delivery_method: "email",
  },
  {
    id: "inv_005", user_id: OWNER_USER_ID, invoice_number: "INV-240425", client_id: "cl_005", client_name: "Marcus Johnson", client_email: "mjohnson@protonmail.com", client_phone: "+1 (512) 778-5544", client_address: "555 Riverside Rd, Austin, TX 78741",
    items: [{ description: "Deck board replacement", quantity: 1, rate: 1850, amount: 1850 }, { description: "Privacy fence panel install", quantity: 8, rate: 220, amount: 1760 }],
    subtotal: 3610, tax_rate: 8.25, tax_amount: 297.83, total: 3907.83, status: "draft", due_date: iso(addDays(now, 30)), notes: "Awaiting client approval before sending.", delivery_method: "download",
  },
  {
    id: "inv_006", user_id: OWNER_USER_ID, invoice_number: "INV-240502", client_id: "cl_006", client_name: "Highland Cafe LLC", client_email: "manager@highlandcafe.com", client_phone: "+1 (512) 889-2233", client_address: "77 Highland Ave, Austin, TX 78752",
    items: [{ description: "Commercial kitchen hood ducting", quantity: 1, rate: 3400, amount: 3400 }, { description: "Stainless steel backsplash", quantity: 1, rate: 1850, amount: 1850 }, { description: "Floor drain relocation", quantity: 1, rate: 950, amount: 950 }],
    subtotal: 6200, tax_rate: 8.25, tax_amount: 511.50, total: 6711.50, status: "paid", due_date: iso(addDays(now, -60)), paid_date: iso(addDays(now, -55)), notes: "", delivery_method: "email",
  },
  {
    id: "inv_007", user_id: OWNER_USER_ID, invoice_number: "INV-240518", client_id: "cl_007", client_name: "Elena Rodriguez", client_email: "elena.r@outlook.com", client_phone: "+1 (512) 990-8877", client_address: "2100 South Congress Ave, Austin, TX 78704",
    items: [{ description: "Bathroom vanity and mirror install", quantity: 1, rate: 1200, amount: 1200 }, { description: "Porcelain tile flooring", quantity: 120, rate: 8.5, amount: 1020 }, { description: "Shower glass enclosure", quantity: 1, rate: 1400, amount: 1400 }],
    subtotal: 3620, tax_rate: 8.25, tax_amount: 298.65, total: 3918.65, status: "sent", due_date: iso(addDays(now, 8)), notes: "Second deposit invoice.", delivery_method: "email",
  },
  {
    id: "inv_008", user_id: OWNER_USER_ID, invoice_number: "INV-240601", client_id: "cl_008", client_name: "Beacon Hill Apartments", client_email: "maintenance@beaconhillapt.com", client_phone: "+1 (512) 101-5566", client_address: "400 Beacon Hill Dr, Austin, TX 78753",
    items: [{ description: "Drywall patch and texture (4 units)", quantity: 4, rate: 320, amount: 1280 }, { description: "Interior paint (4 units)", quantity: 4, rate: 450, amount: 1800 }],
    subtotal: 3080, tax_rate: 8.25, tax_amount: 254.10, total: 3334.10, status: "paid", due_date: iso(addDays(now, -20)), paid_date: iso(addDays(now, -18)), notes: "", delivery_method: "email",
  },
  {
    id: "inv_009", user_id: OWNER_USER_ID, invoice_number: "INV-240615", client_id: "cl_001", client_name: "Sarah Thompson", client_email: "sarah.t@thompsonhome.com", client_phone: "+1 (512) 334-1122", client_address: "1201 Maple Dr, Austin, TX 78704",
    items: [{ description: "Exterior door replacement", quantity: 2, rate: 650, amount: 1300 }, { description: "Trim carpentry", quantity: 1, rate: 480, amount: 480 }],
    subtotal: 1780, tax_rate: 8.25, tax_amount: 146.85, total: 1926.85, status: "sent", due_date: iso(addDays(now, 5)), notes: "", delivery_method: "email",
  },
  {
    id: "inv_010", user_id: OWNER_USER_ID, invoice_number: "INV-240701", client_id: "cl_003", client_name: "David & Rachel Chen", client_email: "dchen@gmail.com", client_phone: "+1 (512) 556-7766", client_address: "3400 Barton Creek Blvd, Austin, TX 78735",
    items: [{ description: "Kitchen design consultation", quantity: 1, rate: 450, amount: 450 }, { description: "3D renderings", quantity: 3, rate: 150, amount: 450 }],
    subtotal: 900, tax_rate: 8.25, tax_amount: 74.25, total: 974.25, status: "paid", due_date: iso(addDays(now, -90)), paid_date: iso(addDays(now, -88)), notes: "Initial deposit.", delivery_method: "email",
  },
  {
    id: "inv_011", user_id: OWNER_USER_ID, invoice_number: "INV-240715", client_id: "cl_004", client_name: "Austin Wellness Center", client_email: "facilities@austinwellness.com", client_phone: "+1 (512) 667-3344", client_address: "900 Wellness Way, Austin, TX 78731",
    items: [{ description: "HVAC vent relocation", quantity: 2, rate: 550, amount: 1100 }, { description: "Insulation upgrade", quantity: 1, rate: 800, amount: 800 }],
    subtotal: 1900, tax_rate: 8.25, tax_amount: 156.75, total: 2056.75, status: "cancelled", due_date: iso(addDays(now, -5)), notes: "Project cancelled by client.", delivery_method: "email",
  },
  {
    id: "inv_012", user_id: OWNER_USER_ID, invoice_number: "INV-240802", client_id: "cl_006", client_name: "Highland Cafe LLC", client_email: "manager@highlandcafe.com", client_phone: "+1 (512) 889-2233", client_address: "77 Highland Ave, Austin, TX 78752",
    items: [{ description: "Bar countertop (reclaimed wood)", quantity: 1, rate: 2200, amount: 2200 }, { description: "Shelving install", quantity: 6, rate: 120, amount: 720 }],
    subtotal: 2920, tax_rate: 8.25, tax_amount: 240.90, total: 3160.90, status: "overdue", due_date: iso(addDays(now, -12)), notes: "Final payment outstanding.", delivery_method: "email",
  },
];

invoices.forEach((inv, idx) => {
  inv.created_date = iso(addDays(now, -120 + idx * 10));
});

const quotes = [
  {
    id: "qte_001", user_id: OWNER_USER_ID, quote_number: "QTE-240101", client_id: "cl_001", client_name: "Sarah Thompson", client_email: "sarah.t@thompsonhome.com",
    items: [{ description: "Guest bathroom renovation", quantity: 1, rate: 6800, amount: 6800 }, { description: "Walk-in shower conversion", quantity: 1, rate: 2400, amount: 2400 }],
    subtotal: 9200, tax_rate: 8.25, tax_amount: 759.00, total: 9959.00, status: "approved", date_issued: iso(addDays(now, -90)), expiry_date: iso(addDays(now, -60)), notes: "Approved. Scheduling for March.", public_id: "pub_qte_001", approval_token: "tkn_001",
  },
  {
    id: "qte_002", user_id: OWNER_USER_ID, quote_number: "QTE-240115", client_id: "cl_002", client_name: "Oakridge Property Management", client_email: "accounts@oakridgepm.com",
    items: [{ description: "Parking lot lighting pole install", quantity: 4, rate: 850, amount: 3400 }, { description: "Electrical trenching", quantity: 1, rate: 1200, amount: 1200 }],
    subtotal: 4600, tax_rate: 8.25, tax_amount: 379.50, total: 4979.50, status: "converted", date_issued: iso(addDays(now, -75)), expiry_date: iso(addDays(now, -45)), notes: "Converted to invoice INV-240302.", public_id: "pub_qte_002", linked_invoice_id: "inv_002",
  },
  {
    id: "qte_003", user_id: OWNER_USER_ID, quote_number: "QTE-240201", client_id: "cl_005", client_name: "Marcus Johnson", client_email: "mjohnson@protonmail.com",
    items: [{ description: "Pressure-treated deck boards", quantity: 350, rate: 3.2, amount: 1120 }, { description: "Deck staining and sealing", quantity: 1, rate: 950, amount: 950 }],
    subtotal: 2070, tax_rate: 8.25, tax_amount: 170.78, total: 2240.78, status: "sent", date_issued: iso(addDays(now, -50)), expiry_date: iso(addDays(now, -20)), notes: "Awaiting client decision.", public_id: "pub_qte_003",
  },
  {
    id: "qte_004", user_id: OWNER_USER_ID, quote_number: "QTE-240210", client_id: "cl_007", client_name: "Elena Rodriguez", client_email: "elena.r@outlook.com",
    items: [{ description: "Master closet built-ins", quantity: 1, rate: 3200, amount: 3200 }, { description: "Mirror installation", quantity: 2, rate: 180, amount: 360 }],
    subtotal: 3560, tax_rate: 8.25, tax_amount: 293.70, total: 3853.70, status: "declined", date_issued: iso(addDays(now, -40)), expiry_date: iso(addDays(now, -10)), notes: "Client decided to postpone.", public_id: "pub_qte_004",
  },
  {
    id: "qte_005", user_id: OWNER_USER_ID, quote_number: "QTE-240305", client_id: "cl_004", client_name: "Austin Wellness Center", client_email: "facilities@austinwellness.com",
    items: [{ description: "Massage therapy room build-out", quantity: 1, rate: 4500, amount: 4500 }, { description: "Soundproofing panels", quantity: 12, rate: 120, amount: 1440 }],
    subtotal: 5940, tax_rate: 8.25, tax_amount: 490.05, total: 6430.05, status: "approved", date_issued: iso(addDays(now, -30)), expiry_date: iso(addDays(now, 0)), notes: "Approved. Start date TBD.", public_id: "pub_qte_005",
  },
  {
    id: "qte_006", user_id: OWNER_USER_ID, quote_number: "QTE-240320", client_id: "cl_008", client_name: "Beacon Hill Apartments", client_email: "maintenance@beaconhillapt.com",
    items: [{ description: "Exterior painting (2 buildings)", quantity: 2, rate: 2800, amount: 5600 }, { description: "Wood rot replacement", quantity: 1, rate: 1400, amount: 1400 }],
    subtotal: 7000, tax_rate: 8.25, tax_amount: 577.50, total: 7577.50, status: "sent", date_issued: iso(addDays(now, -15)), expiry_date: iso(addDays(now, 15)), notes: "", public_id: "pub_qte_006",
  },
  {
    id: "qte_007", user_id: OWNER_USER_ID, quote_number: "QTE-240401", client_id: "cl_006", client_name: "Highland Cafe LLC", client_email: "manager@highlandcafe.com",
    items: [{ description: "Outdoor patio deck construction", quantity: 1, rate: 8500, amount: 8500 }, { description: "Pergola install", quantity: 1, rate: 3200, amount: 3200 }],
    subtotal: 11700, tax_rate: 8.25, tax_amount: 965.25, total: 12665.25, status: "draft", date_issued: iso(addDays(now, -5)), expiry_date: iso(addDays(now, 25)), notes: "Draft pending final measurements.", public_id: "pub_qte_007",
  },
  {
    id: "qte_008", user_id: OWNER_USER_ID, quote_number: "QTE-240410", client_id: "cl_003", client_name: "David & Rachel Chen", client_email: "dchen@gmail.com",
    items: [{ description: "Laundry room cabinetry", quantity: 1, rate: 2100, amount: 2100 }, { description: "Countertop and sink", quantity: 1, rate: 950, amount: 950 }],
    subtotal: 3050, tax_rate: 8.25, tax_amount: 251.63, total: 3301.63, status: "sent", date_issued: iso(addDays(now, -8)), expiry_date: iso(addDays(now, 22)), notes: "", public_id: "pub_qte_008",
  },
];

const jobs = [
  { id: "job_001", user_id: OWNER_USER_ID, job_title: "Thompson Master Bath Renovation", client_id: "cl_001", client_name: "Sarah Thompson", description: "Complete gut and rebuild of master bathroom.", status: "completed", location: "1201 Maple Dr, Austin, TX 78704", start_date: iso(addDays(now, -100)), completion_date: iso(addDays(now, -60)), estimated_hours: 80, hourly_rate: 85, labor_cost: 6800, materials_cost: 2400, estimated_cost: 9200, actual_cost: 9959, linked_invoice_id: "inv_001", linked_quote_id: "qte_001" },
  { id: "job_002", user_id: OWNER_USER_ID, job_title: "Oakridge Lobby Repair", client_id: "cl_002", client_name: "Oakridge Property Management", description: "Drywall repair and repaint office lobby.", status: "completed", location: "88 Corporate Park, Austin, TX 78701", start_date: iso(addDays(now, -80)), completion_date: iso(addDays(now, -70)), estimated_hours: 24, hourly_rate: 75, labor_cost: 1800, materials_cost: 650, estimated_cost: 2450, actual_cost: 2652, linked_invoice_id: "inv_002", linked_quote_id: "qte_002" },
  { id: "job_003", user_id: OWNER_USER_ID, job_title: "Chen Kitchen Renovation", client_id: "cl_003", client_name: "David & Rachel Chen", description: "Full kitchen renovation including cabinets, countertops, lighting.", status: "in_progress", location: "3400 Barton Creek Blvd, Austin, TX 78735", start_date: iso(addDays(now, -45)), completion_date: "", estimated_hours: 120, hourly_rate: 90, labor_cost: 10800, materials_cost: 4750, estimated_cost: 15550, actual_cost: 15533.88, linked_invoice_id: "inv_003", linked_quote_id: "" },
  { id: "job_004", user_id: OWNER_USER_ID, job_title: "Wellness Center Reception Build-Out", client_id: "cl_004", client_name: "Austin Wellness Center", description: "Reception desk and flooring for new location.", status: "in_progress", location: "900 Wellness Way, Austin, TX 78731", start_date: iso(addDays(now, -20)), completion_date: "", estimated_hours: 40, hourly_rate: 80, labor_cost: 3200, materials_cost: 2025, estimated_cost: 5225, actual_cost: 5223.06, linked_invoice_id: "inv_004", linked_quote_id: "qte_005" },
  { id: "job_005", user_id: OWNER_USER_ID, job_title: "Johnson Deck & Fence", client_id: "cl_005", client_name: "Marcus Johnson", description: "Deck repair and privacy fence installation.", status: "planning", location: "555 Riverside Rd, Austin, TX 78741", start_date: iso(addDays(now, 5)), completion_date: "", estimated_hours: 32, hourly_rate: 70, labor_cost: 2240, materials_cost: 1668, estimated_cost: 3908, actual_cost: 0, linked_invoice_id: "inv_005", linked_quote_id: "qte_003" },
  { id: "job_006", user_id: OWNER_USER_ID, job_title: "Highland Cafe Kitchen Upgrades", client_id: "cl_006", client_name: "Highland Cafe LLC", description: "Commercial kitchen hood and backsplash work.", status: "completed", location: "77 Highland Ave, Austin, TX 78752", start_date: iso(addDays(now, -90)), completion_date: iso(addDays(now, -75)), estimated_hours: 48, hourly_rate: 85, labor_cost: 4080, materials_cost: 2632, estimated_cost: 6712, actual_cost: 6711.50, linked_invoice_id: "inv_006", linked_quote_id: "" },
];

const jobPhotos = [
  { id: "jp_001", user_id: OWNER_USER_ID, job_id: "job_003", client_id: "cl_003", uploaded_by_user_id: OWNER_USER_ID, uploaded_by_name: "James Miller", photo_url: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=800&q=80", thumbnail_url: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=200&q=60", category: "before", caption: "Before: existing kitchen layout", position: 0 },
  { id: "jp_002", user_id: OWNER_USER_ID, job_id: "job_003", client_id: "cl_003", uploaded_by_user_id: OWNER_USER_ID, uploaded_by_name: "James Miller", photo_url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80", thumbnail_url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=200&q=60", category: "during", caption: "Cabinets installed, countertop templated", position: 1 },
  { id: "jp_003", user_id: OWNER_USER_ID, job_id: "job_004", client_id: "cl_004", uploaded_by_user_id: OWNER_USER_ID, uploaded_by_name: "James Miller", photo_url: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80", thumbnail_url: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=200&q=60", category: "before", caption: "Reception area before build-out", position: 0 },
  { id: "jp_004", user_id: OWNER_USER_ID, job_id: "job_001", client_id: "cl_001", uploaded_by_user_id: OWNER_USER_ID, uploaded_by_name: "James Miller", photo_url: "https://images.unsplash.com/photo-1620626012053-1c1e173387ee?auto=format&fit=crop&w=800&q=80", thumbnail_url: "https://images.unsplash.com/photo-1620626012053-1c1e173387ee?auto=format&fit=crop&w=200&q=60", category: "after", caption: "Finished master bath", position: 0 },
];

const jobMaterials = [
  { id: "jm_001", user_id: OWNER_USER_ID, job_id: "job_003", item_name: "White shaker base cabinets", quantity: 12, unit: "ea", price_estimate: 220, total_estimate: 2640, purchased: true, purchase_date: iso(addDays(now, -50)), position: 0 },
  { id: "jm_002", user_id: OWNER_USER_ID, job_id: "job_003", item_name: "Quartz countertop slab", quantity: 2, unit: "slab", price_estimate: 1100, total_estimate: 2200, purchased: true, purchase_date: iso(addDays(now, -48)), position: 1 },
  { id: "jm_003", user_id: OWNER_USER_ID, job_id: "job_005", item_name: "Pressure-treated 5/4 decking", quantity: 400, unit: "lf", price_estimate: 2.8, total_estimate: 1120, purchased: false, position: 0 },
];

const jobNotes = [
  { id: "jn_001", job_id: "job_003", user_id: OWNER_USER_ID, user_name: "James Miller", user_email: "james.miller@axisdemo.com", content: "Countertops delayed by 3 days. Client notified.", note_type: "general" },
  { id: "jn_002", job_id: "job_001", user_id: OWNER_USER_ID, user_name: "James Miller", user_email: "james.miller@axisdemo.com", content: "Final punch list complete. Client signed off.", note_type: "completion" },
];

const recurringInvoices = [
  { id: "ri_001", user_id: OWNER_USER_ID, client_id: "cl_002", client_name: "Oakridge Property Management", client_email: "accounts@oakridgepm.com", items: [{ description: "Monthly property maintenance retainer", quantity: 1, rate: 1200, amount: 1200 }], subtotal: 1200, tax_rate: 8.25, tax_amount: 99, total: 1299, frequency: "monthly", start_date: iso(addDays(now, -60)), end_type: "never", next_generation_date: iso(addDays(now, 10)), last_generated_date: iso(addDays(now, -20)), invoices_generated: 2, status: "active", template_name: "Oakridge Monthly Retainer" },
  { id: "ri_002", user_id: OWNER_USER_ID, client_id: "cl_008", client_name: "Beacon Hill Apartments", client_email: "maintenance@beaconhillapt.com", items: [{ description: "Quarterly turnover painting", quantity: 4, rate: 450, amount: 1800 }], subtotal: 1800, tax_rate: 8.25, tax_amount: 148.50, total: 1948.50, frequency: "quarterly", start_date: iso(addDays(now, -90)), end_type: "after", occurrences: 4, next_generation_date: iso(addDays(now, 5)), last_generated_date: iso(addDays(now, -85)), invoices_generated: 1, status: "active", template_name: "Beacon Hill Quarterly Paint" },
];

const invoiceTemplates = [
  { id: "it_001", user_id: OWNER_USER_ID, template_name: "Lock Removal Service", items: [{ description: "Lock removal", quantity: 1, rate: 50, amount: 50 }, { description: "Rekey service", quantity: 1, rate: 35, amount: 35 }], notes: "Cash or check accepted.", tax_rate: 8.25 },
  { id: "it_002", user_id: OWNER_USER_ID, template_name: "Handyman Hourly", items: [{ description: "General handyman labor", quantity: 4, rate: 75, amount: 300 }], notes: "Materials billed separately.", tax_rate: 8.25 },
];

const receipts = [
  { id: "rc_001", user_id: OWNER_USER_ID, vendor_name: "Home Depot", vendor_city: "Austin", vendor_state: "TX", vendor_country: "United States", receipt_date: iso(addDays(now, -50)), total_amount: 487.23, items: [{ description: "Grout and tile adhesive", quantity: 5, price_paid: 18.99 }], file_url: "https://placehold.co/400x600?text=Receipt+1", status: "analyzed", total_savings: 12.50 },
  { id: "rc_002", user_id: OWNER_USER_ID, vendor_name: "Lowe's", vendor_city: "Austin", vendor_state: "TX", vendor_country: "United States", receipt_date: iso(addDays(now, -30)), total_amount: 212.40, items: [{ description: "Paint rollers and brushes", quantity: 10, price_paid: 21.24 }], file_url: "https://placehold.co/400x600?text=Receipt+2", status: "analyzed", total_savings: 0 },
];

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function remapUserId(data, userId) {
  const cloned = deepClone(data);
  if (Array.isArray(cloned)) {
    return cloned.map((item) => remapUserId(item, userId));
  }
  if (cloned && typeof cloned === "object") {
    Object.keys(cloned).forEach((key) => {
      if (cloned[key] === OWNER_USER_ID) cloned[key] = userId;
      if (key === "uploaded_by_user_id" && cloned[key] === OWNER_USER_ID) cloned[key] = userId;
      if (key === "owner_id" && cloned[key] === OWNER_USER_ID) cloned[key] = userId;
    });
  }
  return cloned;
}

export function seedAllDataForUser(userId) {
  if (!userId) return;
  const key = `invoicium_seeded_for_${userId}`;
  if (localStorage.getItem(key)) return; // already seeded for this user

  localDataEngine.seed("BusinessSettings", remapUserId([businessSettings], userId));
  localDataEngine.seed("Subscription", remapUserId([subscription], userId));
  localDataEngine.seed("Client", remapUserId(clients, userId));
  localDataEngine.seed("Invoice", remapUserId(invoices, userId));
  localDataEngine.seed("Quote", remapUserId(quotes, userId));
  localDataEngine.seed("Job", remapUserId(jobs, userId));
  localDataEngine.seed("JobPhoto", remapUserId(jobPhotos, userId));
  localDataEngine.seed("JobMaterial", remapUserId(jobMaterials, userId));
  localDataEngine.seed("JobNote", remapUserId(jobNotes, userId));
  localDataEngine.seed("RecurringInvoice", remapUserId(recurringInvoices, userId));
  localDataEngine.seed("InvoiceTemplate", remapUserId(invoiceTemplates, userId));
  localDataEngine.seed("Receipt", remapUserId(receipts, userId));

  localStorage.setItem(key, "true");
}

// Legacy wrapper for old callers
export function seedAllData() {
  seedAllDataForUser(OWNER_USER_ID);
}

export function getLocalUser() {
  try {
    const raw = localStorage.getItem("invoicium_user");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.id) return parsed;
    }
  } catch (e) {
    console.error("Failed to parse local user", e);
  }
  return ownerUser;
}
