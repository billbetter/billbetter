-- Per-business colour theming for the React-PDF invoice templates.
--
-- BusinessSettings is all flat scalar columns (pdf_footer_text, font_family,
-- show_pdf_branding ...), so these are flat text columns too rather than a jsonb
-- blob that would have been the odd one out. `pdf_color_scheme` already existed
-- and carries primaryColor; the other three are new.
--
-- NULL means "not customised" -- src/lib/invoiceTheme.js derives those from the
-- background so the result stays readable, instead of falling back to a fixed
-- light-page constant that would be invisible on a dark page.

alter table public."BusinessSettings"
  add column if not exists pdf_background_color text,
  add column if not exists pdf_text_color text,
  add column if not exists pdf_muted_text_color text;

comment on column public."BusinessSettings".pdf_color_scheme is
  'Invoice PDF primary colour: header bars, section titles, totals box. Hex, e.g. #0369A1.';
comment on column public."BusinessSettings".pdf_background_color is
  'Invoice PDF page background. Hex. NULL = white.';
comment on column public."BusinessSettings".pdf_text_color is
  'Invoice PDF body text. Hex. NULL = derived from the background.';
comment on column public."BusinessSettings".pdf_muted_text_color is
  'Invoice PDF labels and secondary text. Hex. NULL = derived from text + background.';

-- pdf_color_scheme shipped defaulting to '#10b981' -- the retired AxisBill
-- emerald, which the rest of the app replaced with #0369A1. It was never
-- rendered: nothing outside the settings form read the column until now.
--
-- So every existing row holds a colour its owner never chose and has never seen.
-- Honouring it here would silently restyle every business's invoices to a dead
-- brand colour the moment this deploys. Rows still holding that untouched
-- default are reset to black -- what their PDFs actually look like today --
-- while any business that deliberately picked a different colour keeps it and
-- finally gets it rendered.
update public."BusinessSettings"
   set pdf_color_scheme = '#000000'
 where pdf_color_scheme is null
    or lower(pdf_color_scheme) = '#10b981';

-- New rows should start from the look they will actually render as.
alter table public."BusinessSettings"
  alter column pdf_color_scheme set default '#000000';
