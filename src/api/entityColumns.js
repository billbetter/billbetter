/**
 * Real column names per table, generated from the live database schema.
 *
 * DO NOT EDIT BY HAND. Regenerate with:
 *
 *     python scripts/gen-entity-columns.py
 *
 * -- Why this exists -------------------------------------------------------
 *
 * PostgREST rejects an entire INSERT or PATCH if the body contains one key that
 * is not a column. It does not ignore the key; it fails the request with
 * `42703 column X does not exist`. So a single stray field in a form's state
 * stops EVERY field on that page from saving.
 *
 * That is not hypothetical. src/pages/Settings.jsx builds its payload as
 * `{ ...formData }`, and CalendarSettings binds inputs to `booking_slug` and
 * `available_hours` -- neither of which is a column. Typing in the booking URL
 * field broke saving for every unrelated setting on the page, and the only
 * feedback was "Failed to save settings. Please try again."
 *
 * localDataEngine strips unknown keys against this map before writing, and
 * warns loudly in development naming each key it dropped. It warns rather than
 * staying silent because a silent strip turns a typo'd column name into a
 * setting that never saves and never complains -- which is the same class of
 * bug, just quieter.
 *
 * A table absent from this map is not stripped at all, so a stale file degrades
 * to today's behaviour rather than dropping data.
 */

export const ENTITY_COLUMNS = {
  "BusinessSettings": ["id", "user_id", "business_name", "email", "phone", "address", "website", "timezone", "tax_rate", "hourly_rate", "invoice_prefix", "payment_terms", "payment_methods", "pdf_color_scheme", "pdf_footer_text", "show_pdf_branding", "font_family", "invoice_template", "stripe_account_status", "stripe_onboarding_completed", "google_calendar_connected", "booking_enabled", "default_appointment_duration", "booking_buffer_time", "booking_notice_time", "send_review_requests", "analytics_email_frequency", "analytics_email_day", "analytics_email_time", "created_at", "updated_at", "stripe_account_id", "currency", "google_calendar_id", "pdf_background_color", "pdf_text_color", "pdf_muted_text_color", "logo_url", "serpapi_key", "review_link", "email_subject_template", "email_body_template", "custom_template_config", "allow_client_quote_approval", "notification_preferences"],
  "Client": ["id", "user_id", "name", "email", "phone", "address", "notes", "total_invoiced", "created_at", "updated_at"],
  "CrewInvite": ["id", "owner_id", "email", "name", "role", "custom_title", "status", "accepted_at", "accepted_by_user_id", "created_at", "token", "expires_at"],
  "CrewMemberSettings": ["id", "user_id", "profile_picture_url", "theme", "notifications_enabled", "email_notifications", "sms_notifications", "display_name", "created_at"],
  "EmployeeProfile": ["id", "user_id", "owner_id", "custom_title", "role", "permissions", "is_active", "created_at", "name", "email", "hourly_rate", "phone", "removed_at"],
  "Invoice": ["id", "user_id", "invoice_number", "client_id", "client_name", "client_email", "client_phone", "client_address", "items", "subtotal", "tax_rate", "tax_amount", "total", "status", "date_issued", "due_date", "paid_date", "notes", "delivery_method", "payment_link", "pdf_url", "created_at", "updated_at", "stripe_payment_intent_id", "stripe_session_id", "platform_fee_amount", "payment_terms", "pdf_generated_at", "public_token", "public_link_revoked_at", "first_viewed_at", "last_viewed_at", "view_count", "platform_fee_percent", "payment_plan_id", "plan_stage_id", "last_reminder_sent_at", "reminder_count", "voided_at", "void_reason", "voided_by", "voided_by_name", "demand_letter_prompted_at", "demand_letter_dismissed_at", "demand_letter_sent_at"],
  "InvoiceEvent": ["id", "user_id", "invoice_id", "at", "kind", "from_status", "to_status", "detail", "actor_id", "actor_name", "created_at"],
  "InvoicePayment": ["id", "user_id", "invoice_id", "amount", "paid_at", "method", "reference", "notes", "stripe_payment_intent_id", "recorded_by", "recorded_by_name", "created_at"],
  "InvoiceTemplate": ["id", "user_id", "template_name", "items", "notes", "tax_rate", "created_at"],
  "Job": ["id", "user_id", "job_title", "client_id", "client_name", "description", "status", "location", "start_date", "completion_date", "estimated_hours", "hourly_rate", "labor_cost", "materials_cost", "estimated_cost", "actual_cost", "linked_invoice_id", "linked_quote_id", "scheduled_start_time", "scheduled_end_time", "created_at", "updated_at", "actual_hours"],
  "JobExpense": ["id", "user_id", "job_id", "description", "vendor", "category", "amount", "quantity", "unit_cost", "markup_percent", "billable_amount", "include_in_invoice", "receipt_url", "expense_date", "notes", "created_at"],
  "JobMaterial": ["id", "user_id", "job_id", "item_name", "quantity", "unit", "price_estimate", "total_estimate", "purchased", "purchase_date", "position", "created_at"],
  "JobNote": ["id", "job_id", "user_id", "user_name", "user_email", "content", "note_type", "created_at"],
  "JobPhoto": ["id", "user_id", "job_id", "client_id", "uploaded_by_user_id", "uploaded_by_name", "photo_url", "thumbnail_url", "category", "caption", "position", "created_at", "is_favorite", "tags", "taken_date", "location_lat", "location_lng"],
  "PaymentPlan": ["id", "user_id", "client_id", "job_id", "quote_id", "title", "client_name", "total_amount", "tax_rate", "notes", "stages", "status", "created_at", "updated_at"],
  "PublicLinkHit": ["id", "invoice_id", "hit_at", "is_bot", "referrer", "dedupe_hash", "quote_id"],
  "Quote": ["id", "user_id", "quote_number", "client_id", "client_name", "client_email", "items", "subtotal", "tax_rate", "tax_amount", "total", "status", "date_issued", "expiry_date", "notes", "public_id", "approval_token", "linked_invoice_id", "created_at", "updated_at", "pdf_url", "pdf_generated_at", "camera_photo_url", "camera_description", "ai_analysis", "job_id", "public_link_revoked_at", "first_viewed_at", "last_viewed_at", "view_count", "approved_by_name", "approved_at", "declined_by_name", "declined_at", "decline_reason"],
  "Receipt": ["id", "user_id", "vendor_name", "vendor_city", "vendor_state", "vendor_country", "receipt_date", "total_amount", "items", "file_url", "status", "total_savings", "created_at"],
  "RecurringInvoice": ["id", "user_id", "client_id", "client_name", "client_email", "items", "subtotal", "tax_rate", "tax_amount", "total", "frequency", "start_date", "end_type", "occurrences", "next_generation_date", "last_generated_date", "invoices_generated", "status", "template_name", "created_at", "updated_at", "payment_terms", "client_phone", "notes", "end_date"],
  "Subscription": ["id", "user_id", "plan_name", "billing_cycle", "monthly_transaction_limit", "lifetime_documents_created", "transactions_used_this_month", "invoices_used_this_month", "quotes_used_this_month", "payment_processing_fee", "status", "subscription_start_date", "next_billing_date", "features", "created_at", "updated_at", "trial_end_date", "stripe_customer_id", "stripe_subscription_id", "subscription_end_date"],
  "TimeEntry": ["id", "user_id", "member_user_id", "member_name", "job_id", "client_id", "started_at", "ended_at", "duration_minutes", "hourly_rate", "billable", "invoiced", "invoice_id", "notes", "created_at", "updated_at"],
  "profiles": ["id", "full_name", "onboarding_completed", "role", "updated_at"],
};
