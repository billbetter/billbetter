import { useState } from "react";
import { supabase } from "@/api/supabaseClient";

/**
 * The Security tab's change-password form: its fields, whether it is open,
 * and the update. Outcomes are reported through the page's `setSaveMessage`.
 */
export default function usePasswordChange(setSaveMessage) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  // The Security tab used to open straight into an empty "New Password" form,
  // which reads as the app telling you to change your password. It is an
  // action you take, not a demand, so the form stays behind a button.
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 12) {
      setSaveMessage("Failed: Password must be at least 12 characters.");
      setTimeout(() => setSaveMessage(null), 3000);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setSaveMessage("Failed: Passwords do not match.");
      setTimeout(() => setSaveMessage(null), 3000);
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      setNewPassword("");
      setConfirmNewPassword("");
      setShowPasswordForm(false);
      setSaveMessage("Password updated successfully.");
    } catch (err) {
      console.error("Change password error:", err);
      setSaveMessage(`Failed: ${err?.message || "Could not update password."}`);
    } finally {
      setChangingPassword(false);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  return {
    newPassword, setNewPassword, confirmNewPassword, setConfirmNewPassword,
    changingPassword, showPasswordForm, setShowPasswordForm, handleChangePassword,
  };
}
