import React, { useState, useRef, useEffect } from "react";
import { sdk } from "@/api/sdk";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Camera,
  Upload,
  X,
  Loader2,
  MapPin,
  Check,
  AlertCircle,
  Crown,
} from "lucide-react";

export default function PhotoUploadModal({
  isOpen,
  onClose,
  jobId,
  onUploadComplete,
}) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState("other");
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState("");
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [cameraPermission, setCameraPermission] = useState(null);
  const [locationPermission, setLocationPermission] = useState(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      loadSubscription();
      checkPermissions();
    }
  }, [isOpen]);

  const loadSubscription = async () => {
    try {
      const user = await sdk.auth.me();
      const subs = await sdk.entities.Subscription.filter({ user_id: user.id });
      if (subs.length > 0) {
        setSubscription(subs[0]);
      }
    } catch (error) {
      console.error("Error loading subscription:", error);
    }
  };

  const checkPermissions = async () => {
    // Check camera permission
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        stream.getTracks().forEach((track) => track.stop());
        setCameraPermission("granted");
      } catch (error) {
        setCameraPermission(
          error.name === "NotAllowedError" ? "denied" : "prompt",
        );
      }
    }

    // Check location permission
    if (navigator.permissions) {
      try {
        const result = await navigator.permissions.query({
          name: "geolocation",
        });
        setLocationPermission(result.state);
        result.onchange = () => setLocationPermission(result.state);
      } catch (error) {
        setLocationPermission("prompt");
      }
    }
  };

  const isEnterprise = subscription?.plan_name === "enterprise";

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...selectedFiles]);
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const requestCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      setCameraPermission("granted");
      cameraInputRef.current?.click();
    } catch (error) {
      if (error.name === "NotAllowedError") {
        setCameraPermission("denied");
        alert(
          "Camera access denied. Please enable camera permissions in your browser settings.",
        );
      }
    }
  };

  const requestLocationPermission = () => {
    setLocationLoading(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setLocationPermission("granted");
          setLocationLoading(false);
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            setLocationPermission("denied");
            alert(
              "Location access denied. Please enable location permissions in your browser settings.",
            );
          }
          console.error("Error getting location:", error);
          setLocationLoading(false);
        },
      );
    } else {
      setLocationLoading(false);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      alert("Please select at least one photo");
      return;
    }

    setUploading(true);
    try {
      const currentUser = await sdk.auth.me();

      // Get job details
      const jobs = await sdk.entities.Job.filter({ id: jobId });
      if (jobs.length === 0) {
        throw new Error("Job not found");
      }
      const job = jobs[0];

      const tagArray = tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t);

      for (const file of files) {
        // Upload file
        const uploadResult = await sdk.integrations.Core.UploadFile({ file });

        // Create photo record
        await sdk.entities.JobPhoto.create({
          user_id: currentUser.id,
          job_id: jobId,
          client_id: job.client_id,
          uploaded_by_user_id: currentUser.id,
          uploaded_by_name: currentUser.full_name,
          photo_url: uploadResult.file_url,
          thumbnail_url: uploadResult.file_url, // Same for now, could generate thumbnails
          category,
          caption,
          tags: tagArray,
          is_favorite: false,
          location_lat: location?.lat,
          location_lng: location?.lng,
          taken_date: new Date().toISOString(),
          position: 0,
        });
      }

      onUploadComplete();
      handleClose();
    } catch (error) {
      console.error("Error uploading photos:", error);
      alert("Failed to upload photos. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFiles([]);
    setCategory("other");
    setCaption("");
    setTags("");
    setLocation(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Job Photos</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Enterprise Feature Badge */}
          {!isEnterprise && (
            <Alert className="border-warning-200 bg-warning-50 dark:border-warning-800/50 dark:bg-warning-900/20">
              <Crown className="w-4 h-4 text-warning-600" />
              <AlertDescription className="text-warning-800 text-sm">
                Camera and GPS features require an Enterprise plan. Upload
                photos from your gallery instead.
              </AlertDescription>
            </Alert>
          )}

          {/* File Selection */}
          <div>
            <Label>Select Photos</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (isEnterprise) {
                    if (cameraPermission === "granted") {
                      cameraInputRef.current?.click();
                    } else {
                      requestCameraPermission();
                    }
                  } else {
                    alert("Camera access requires Enterprise plan");
                  }
                }}
                className="w-full"
                disabled={!isEnterprise}
              >
                <Camera className="w-4 h-4 mr-2" />
                Take Photo
                {!isEnterprise && (
                  <Crown className="w-3 h-3 ml-1 text-warning-500" />
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Files
              </Button>
            </div>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              disabled={!isEnterprise}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Permission Status */}
          {isEnterprise &&
            (cameraPermission === "denied" ||
              locationPermission === "denied") && (
              <Alert className="border-danger-200 bg-danger-50 dark:border-danger-800/50 dark:bg-danger-900/20">
                <AlertCircle className="w-4 h-4 text-danger-600" />
                <AlertDescription className="text-danger-800 text-sm">
                  {cameraPermission === "denied" && "Camera access denied. "}
                  {locationPermission === "denied" &&
                    "Location access denied. "}
                  Enable permissions in your browser settings to use these
                  features.
                </AlertDescription>
              </Alert>
            )}

          {/* Selected Files */}
          {files.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="relative aspect-square bg-ink-100 rounded-lg overflow-hidden dark:bg-ink-800"
                >
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => removeFile(index)}
                    className="absolute top-1 right-1 w-6 h-6 bg-danger-600 text-content-inverted rounded-full flex items-center justify-center hover:bg-danger-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Category */}
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="before">Before</SelectItem>
                <SelectItem value="during">During</SelectItem>
                <SelectItem value="after">After</SelectItem>
                <SelectItem value="issue">Issue</SelectItem>
                <SelectItem value="receipt">Receipt</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Caption */}
          <div>
            <Label>Caption/Notes</Label>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a description..."
              rows={3}
            />
          </div>

          {/* Tags */}
          <div>
            <Label>Tags (comma-separated)</Label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., electrical, wiring, panel"
            />
          </div>

          {/* Location */}
          <div>
            <Label className="flex items-center gap-2">
              Location (GPS)
              {!isEnterprise && <Crown className="w-3 h-3 text-warning-500" />}
            </Label>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (isEnterprise) {
                  requestLocationPermission();
                } else {
                  alert("GPS location tracking requires Enterprise plan");
                }
              }}
              disabled={!isEnterprise || locationLoading || location}
              className="w-full"
            >
              {locationLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Getting location...
                </>
              ) : location ? (
                <>
                  <Check className="w-4 h-4 mr-2 text-positive-600" />
                  Location captured
                </>
              ) : (
                <>
                  <MapPin className="w-4 h-4 mr-2" />
                  Add GPS Location {!isEnterprise && "(Enterprise)"}
                </>
              )}
            </Button>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploading || files.length === 0}
              className="bg-brand hover:bg-brand-hover"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                `Upload ${files.length} Photo${files.length !== 1 ? "s" : ""}`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
