import { useState } from "react";
import { sdk } from "@/api/sdk";
import { calculateTotals } from "./invoiceFormMath";

/**
 * Saved line-item templates: the list, applying one to the form, and the
 * save / rename / delete dialogs with their writes.
 */
export default function useInvoiceTemplates({ user, formData, setFormData }) {
  const [templates, setTemplates] = useState([]);
  const [saveTemplateDialog, setSaveTemplateDialog] = useState(false);
  const [editTemplateDialog, setEditTemplateDialog] = useState(false);
  const [deleteTemplateDialog, setDeleteTemplateDialog] = useState({
    open: false,
    template: null,
  });
  const [templateName, setTemplateName] = useState("");
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState(false);

  const handleLoadTemplate = (template) => {
    const taxRateToUse =
      template.tax_rate !== undefined ? template.tax_rate : formData.tax_rate;
    const totals = calculateTotals(template.items, taxRateToUse);

    setFormData({
      ...formData,
      items: template.items,
      notes: template.notes || formData.notes,
      tax_rate: taxRateToUse,
      ...totals,
    });
  };

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) {
      alert("Please enter a template name");
      return;
    }

    setSavingTemplate(true);
    try {
      await sdk.entities.InvoiceTemplate.create({
        user_id: user.id,
        template_name: templateName,
        items: formData.items,
        notes: formData.notes,
        tax_rate: formData.tax_rate,
      });

      const templateData = await sdk.entities.InvoiceTemplate.filter(
        { user_id: user.id },
        "-created_date",
      );
      setTemplates(templateData);

      setSaveTemplateDialog(false);
      setTemplateName("");
      alert("Template saved successfully!");
    } catch (error) {
      console.error("Error saving template:", error);
      alert("Failed to save template. Please try again.");
    }
    setSavingTemplate(false);
  };

  const handleOpenEditTemplate = (template) => {
    setEditingTemplate(template);
    setTemplateName(template.template_name);
    setEditTemplateDialog(true);
  };

  const handleUpdateTemplate = async () => {
    if (!templateName.trim()) {
      alert("Please enter a template name");
      return;
    }

    setSavingTemplate(true);
    try {
      await sdk.entities.InvoiceTemplate.update(editingTemplate.id, {
        template_name: templateName,
        items: editingTemplate.items,
        notes: editingTemplate.notes,
        tax_rate: editingTemplate.tax_rate,
      });

      const templateData = await sdk.entities.InvoiceTemplate.filter(
        { user_id: user.id },
        "-created_date",
      );
      setTemplates(templateData);

      setEditTemplateDialog(false);
      setEditingTemplate(null);
      setTemplateName("");
      alert("Template updated successfully!");
    } catch (error) {
      console.error("Error updating template:", error);
      alert("Failed to update template. Please try again.");
    }
    setSavingTemplate(false);
  };

  const handleDeleteTemplate = async () => {
    if (!deleteTemplateDialog.template) return;

    setDeletingTemplate(true);
    try {
      await sdk.entities.InvoiceTemplate.delete(
        deleteTemplateDialog.template.id,
      );
      const templateData = await sdk.entities.InvoiceTemplate.filter(
        { user_id: user.id },
        "-created_date",
      );
      setTemplates(templateData);
      setDeleteTemplateDialog({ open: false, template: null });
    } catch (error) {
      console.error("Error deleting template:", error);
      alert("Failed to delete template. Please try again.");
    }
    setDeletingTemplate(false);
  };

  return {
    templates, setTemplates, saveTemplateDialog, setSaveTemplateDialog,
    editTemplateDialog, setEditTemplateDialog, deleteTemplateDialog, setDeleteTemplateDialog,
    templateName, setTemplateName, editingTemplate, savingTemplate, deletingTemplate,
    handleLoadTemplate, handleSaveAsTemplate, handleOpenEditTemplate, handleUpdateTemplate,
    handleDeleteTemplate,
  };
}
