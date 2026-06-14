import type { CompanySettings } from "@/lib/types";

/** Escape HTML special characters for safe injection into print templates. */
export function escHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Build the company header HTML block used by invoice / quotation / PO templates. */
export function buildCompanyHeader(
  settings: CompanySettings | null,
  _docType: "invoice" | "quotation" | "purchase_order"
): string {
  if (!settings) {
    return `
      <div>
        <div class="company-name">Your Company</div>
        <div class="company-info">
          Company address not configured &mdash; go to Settings &rarr; Company Profile<br>
          GST: &nbsp;PAN: &nbsp;Phone:
        </div>
      </div>`;
  }

  const displayName = escHtml(settings.company_name ?? settings.legal_business_name ?? "Your Company");
  // Show legal name as a smaller subtitle if it differs from display name
  const legalSubtitle =
    settings.legal_business_name &&
    settings.legal_business_name !== settings.company_name
      ? `<div style="font-size:9.5px;color:#64748b;margin-top:1px">${escHtml(settings.legal_business_name)}</div>`
      : "";

  const address = [
    settings.address_line_1,
    settings.address_line_2,
    settings.city,
    settings.state,
    settings.pincode ? "– " + settings.pincode : null,
  ]
    .filter(Boolean)
    .map(escHtml)
    .join(", ");

  const infoLines: string[] = [];
  if (address) infoLines.push(address);

  const contactParts: string[] = [];
  if (settings.phone) contactParts.push("Ph: " + escHtml(settings.phone));
  if (settings.email) contactParts.push("E: " + escHtml(settings.email));
  if (settings.website) contactParts.push(escHtml(settings.website));
  if (contactParts.length) infoLines.push(contactParts.join("  |  "));

  const taxParts: string[] = [];
  if (settings.gst_number) taxParts.push("GSTIN: " + escHtml(settings.gst_number));
  if (settings.pan_number) taxParts.push("PAN: " + escHtml(settings.pan_number));
  if (taxParts.length) infoLines.push(taxParts.join("  |  "));

  const logoHtml = settings.logo_url
    ? `<img src="${escHtml(settings.logo_url)}" alt="logo" style="max-height:60px;max-width:180px;object-fit:contain;margin-bottom:6px;display:block" />`
    : "";

  return `
    <div>
      ${logoHtml}
      <div class="company-name">${displayName}</div>
      ${legalSubtitle}
      <div class="company-info">${infoLines.join("<br>")}</div>
    </div>`;
}

/**
 * Authorized signatory block for PDF footers.
 * Shows signature image if uploaded, otherwise a blank line.
 */
export function buildSignatureBlock(settings: CompanySettings | null): string {
  const companyLabel = escHtml(settings?.company_name ?? "");
  const sigLabel = companyLabel
    ? `${companyLabel} — Authorised Signatory`
    : "Authorised Signatory";

  if (settings?.signature_url) {
    return `
      <div class="sig-box">
        <img src="${escHtml(settings.signature_url)}" alt="Authorised Signature"
             style="max-height:50px;max-width:160px;object-fit:contain;display:block;margin:0 auto 6px" />
        <div class="sig-line">${sigLabel}</div>
      </div>`;
  }

  return `
    <div class="sig-box">
      <div class="sig-line">${sigLabel}</div>
    </div>`;
}

/** Payment details footer block (bank + UPI) rendered at the bottom of invoices and quotations. */
export function buildPaymentDetails(settings: CompanySettings | null): string {
  if (!settings) return "";

  const hasBankDetails =
    settings.bank_name || settings.account_number || settings.ifsc_code;
  const hasUPI = !!settings.upi_id;
  if (!hasBankDetails && !hasUPI) return "";

  const bankLines: string[] = [];
  if (settings.bank_name)
    bankLines.push(
      escHtml(settings.bank_name) +
        (settings.branch_name ? ` — ${escHtml(settings.branch_name)}` : "")
    );
  if (settings.account_holder_name)
    bankLines.push("A/C Name: " + escHtml(settings.account_holder_name));
  if (settings.account_number)
    bankLines.push("A/C No: " + escHtml(settings.account_number));
  if (settings.ifsc_code)
    bankLines.push("IFSC: " + escHtml(settings.ifsc_code));
  if (settings.upi_id)
    bankLines.push("UPI: " + escHtml(settings.upi_id));

  return `
    <div style="margin-bottom:20px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:12px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#166534;margin-bottom:6px">Payment Details</div>
      <div style="font-size:10.5px;color:#14532d;line-height:1.8">${bankLines.join("<br>")}</div>
    </div>`;
}

/**
 * Terms, payment terms, and notes block for PDF footers.
 * Falls back gracefully when settings are missing or fields are empty.
 */
export function buildTermsBlock(
  settings: CompanySettings | null,
  docType: "invoice" | "quotation" | "purchase_order" = "invoice"
): string {
  if (!settings) return "";

  const parts: string[] = [];

  // Payment terms (invoices and quotations)
  if (settings.payment_terms && docType !== "purchase_order") {
    parts.push(`
      <div style="margin-bottom:14px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:4px">Payment Terms</div>
        <div style="font-size:10.5px;color:#475569">${escHtml(settings.payment_terms)}</div>
      </div>`);
  }

  // Terms & Conditions
  if (settings.terms_and_conditions) {
    parts.push(`
      <div style="margin-bottom:14px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:6px">Terms &amp; Conditions</div>
        <div style="font-size:10px;color:#64748b;line-height:1.8;white-space:pre-wrap">${escHtml(settings.terms_and_conditions)}</div>
      </div>`);
  }

  // Default notes
  if (settings.default_notes) {
    parts.push(`
      <div style="margin-bottom:14px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:10px">
        <div style="font-size:10.5px;color:#78350f;line-height:1.6">${escHtml(settings.default_notes)}</div>
      </div>`);
  }

  if (parts.length === 0) return "";

  return `<div style="margin-bottom:20px">${parts.join("")}</div>`;
}
