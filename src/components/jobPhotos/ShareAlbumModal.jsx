import React, { useState } from "react";
import { sdk } from "@/api/sdk";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Share2, Copy, Check, Loader2, ExternalLink } from "lucide-react";

export default function ShareAlbumModal({ isOpen, onClose, jobId }) {
  const [generating, setGenerating] = useState(false);
  const [shareLink, setShareLink] = useState(null);
  const [copied, setCopied] = useState(false);
  const [expirationDays, setExpirationDays] = useState("7");
  const [allowDownload, setAllowDownload] = useState(true);

  const generateShareLink = async () => {
    setGenerating(true);
    try {
      const currentUser = await sdk.auth.me();

      // Generate unique token
      const token =
        Math.random().toString(36).substring(2) + Date.now().toString(36);

      // Calculate expiration
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(expirationDays));

      // Create share record
      await sdk.entities.JobPhotoShare.create({
        user_id: currentUser.id,
        job_id: jobId,
        share_token: token,
        expires_at: expiresAt.toISOString(),
        allow_download: allowDownload,
        is_active: true,
        view_count: 0,
      });

      const link = `${window.location.origin}${window.location.pathname}#/shared-photos/${token}`;
      setShareLink(link);
    } catch (error) {
      console.error("Error generating share link:", error);
      alert("Failed to generate share link");
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleClose = () => {
    setShareLink(null);
    setCopied(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Share Job Photos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!shareLink ? (
            <>
              <div>
                <Label>Link Expiration</Label>
                <Select
                  value={expirationDays}
                  onValueChange={setExpirationDays}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="365">1 year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="allowDownload"
                  checked={allowDownload}
                  onChange={(e) => setAllowDownload(e.target.checked)}
                  className="w-4 h-4 text-success-600 rounded"
                />
                <Label htmlFor="allowDownload" className="cursor-pointer">
                  Allow downloads
                </Label>
              </div>

              <Button
                onClick={generateShareLink}
                disabled={generating}
                className="w-full bg-brand hover:bg-brand-hover"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 mr-2" />
                    Generate Share Link
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <div className="p-4 bg-success-50 border border-success-200 rounded-lg dark:bg-success-900/20 dark:border-success-800/50">
                <p className="text-sm text-success-900 font-medium mb-2">
                  ✓ Share link generated!
                </p>
                <p className="text-xs text-success-700">
                  Share this link with your client to give them access to job
                  photos.
                  {expirationDays && ` Link expires in ${expirationDays} days.`}
                </p>
              </div>

              <div>
                <Label>Share Link</Label>
                <div className="flex gap-2 mt-2">
                  <Input value={shareLink} readOnly className="flex-1" />
                  <Button
                    onClick={copyToClipboard}
                    variant="outline"
                    className="flex-shrink-0"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-positive-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => window.open(shareLink, "_blank")}
                  variant="outline"
                  className="flex-1"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Preview
                </Button>
                <Button onClick={handleClose} className="flex-1">
                  Done
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
