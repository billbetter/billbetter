import React, { useState } from "react";
import { PHOTO_ESTIMATE } from "@/lib/ai/schemas";
import { aiFailureMessage } from "@/lib/ai/failure";
import { sdk } from "@/api/sdk";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Camera,
  Upload,
  Loader2,
  Sparkles,
  X,
  CheckCircle,
} from "lucide-react";

export default function CameraAnalyzer({ onAnalysisComplete }) {
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [description, setDescription] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResults, setAiResults] = useState(null);
  const [editedMaterials, setEditedMaterials] = useState([]);
  const [editedLaborHours, setEditedLaborHours] = useState(0);

  const handlePhotoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Only allow images
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file only");
      return;
    }

    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setAiResults(null);
    setEditedMaterials([]);
  };

  const handleAnalyze = async () => {
    if (!description.trim()) {
      alert("Please enter a job description");
      return;
    }

    setAnalyzing(true);
    try {
      let photoUrl = null;

      // Upload photo if provided
      if (photo) {
        const uploadResult = await sdk.integrations.Core.UploadFile({
          file: photo,
        });
        photoUrl = uploadResult.file_url;
      }

      // Build prompt based on whether photo is provided
      const promptText = photo
        ? `You are an expert construction estimator. Carefully analyze this job site photo and the description below to provide an accurate, detailed cost estimate.

Job Description: ${description}

ANALYZE THE PHOTO CAREFULLY and provide a detailed materials list with specific names, quantities, units and current market pricing in CAD. Estimate realistic labor hours based on job complexity (including prep, installation, cleanup). Use typical contractor rates $50-$120/hr CAD. Calculate total project cost and include important considerations.`
        : `You are an expert construction estimator. Based on the job description below, provide an accurate, detailed cost estimate.

Job Description: ${description}

Provide a detailed materials list with specific names, quantities, units and current market pricing in CAD. Estimate realistic labor hours based on job complexity (including prep, installation, cleanup). Use typical contractor rates $50-$120/hr CAD. Calculate total project cost and include important considerations like permits, prep work, or potential issues. Be thorough and realistic.`;

      // Send to AI for analysis
      const aiResponse = await sdk.integrations.Core.InvokeLLM({
        prompt: promptText,
        ...(photoUrl && { file_urls: [photoUrl] }),
        response_json_schema: PHOTO_ESTIMATE,
      });

      setAiResults(aiResponse);
      setEditedMaterials(aiResponse.materials || []);
      setEditedLaborHours(aiResponse.labor_hours || 0);
    } catch (error) {
      console.error("Analysis error:", error);
      alert(aiFailureMessage(error, "an estimate from this photo"));
    }
    setAnalyzing(false);
  };

  const handleMaterialChange = (index, field, value) => {
    const updated = [...editedMaterials];
    updated[index] = { ...updated[index], [field]: value };

    // Recalculate total cost if quantity or price changes
    if (field === "quantity" || field === "price_per_unit") {
      updated[index].total_cost =
        (updated[index].quantity || 0) * (updated[index].price_per_unit || 0);
    }

    setEditedMaterials(updated);
  };

  const handleAddMaterial = () => {
    setEditedMaterials([
      ...editedMaterials,
      { name: "", quantity: 1, unit: "unit", price_per_unit: 0, total_cost: 0 },
    ]);
  };

  const handleRemoveMaterial = (index) => {
    setEditedMaterials(editedMaterials.filter((_, i) => i !== index));
  };

  const handleConfirm = async () => {
    if (!aiResults) return;

    let photoUrl = null;

    // Upload photo if provided
    if (photo) {
      const uploadResult = await sdk.integrations.Core.UploadFile({
        file: photo,
      });
      photoUrl = uploadResult.file_url;
    }

    onAnalysisComplete({
      photoUrl,
      description,
      materials: editedMaterials,
      laborHours: editedLaborHours,
      laborRate: aiResults.labor_rate || 0,
      notes: aiResults.notes,
      estimatedTotal: aiResults.estimated_total || 0,
    });
  };

  const handleReset = () => {
    setPhoto(null);
    setPhotoPreview(null);
    setDescription("");
    setAiResults(null);
    setEditedMaterials([]);
    setEditedLaborHours(0);
  };

  return (
    <Card className="border-none shadow-lg bg-success-50 dark:bg-success-900/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-success-900">
          <Sparkles className="w-5 h-5 text-success-600" />
          AI Assistant
        </CardTitle>
        <p className="text-sm text-success-700">
          Describe the work or upload a photo - AI will estimate materials and
          labor
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!aiResults ? (
          <>
            {/* Job Description */}
            <div>
              <Label htmlFor="job_description">Job Description *</Label>
              <Input
                id="job_description"
                placeholder="e.g., Replace kitchen backsplash, install new flooring, full bathroom renovation"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-success-600 mt-1">
                Describe the work you did. Include hours worked or desired total
                if known - AI will suggest accurate pricing for your region
              </p>
            </div>

            {/* Photo Upload */}
            <div>
              <Label>Upload Job Site Photo (Optional)</Label>
              <div className="mt-2 space-y-3">
                {photoPreview ? (
                  <div className="relative">
                    <img
                      src={photoPreview}
                      alt="Job site"
                      className="w-full h-48 object-cover rounded-lg border-2 border-success-200"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPhoto(null);
                        setPhotoPreview(null);
                      }}
                      className="absolute top-2 right-2 bg-surface/90 hover:bg-surface dark:bg-surface-inverted/90 dark:hover:bg-surface-inverted"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoSelect}
                        className="hidden"
                      />
                      <div className="border-2 border-dashed border-success-300 rounded-lg p-6 hover:bg-success-100 transition-colors text-center dark:hover:bg-success-900/30">
                        <Camera className="w-8 h-8 text-success-600 mx-auto mb-2" />
                        <p className="text-sm font-medium text-success-900">
                          Take Photo
                        </p>
                      </div>
                    </label>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoSelect}
                        className="hidden"
                      />
                      <div className="border-2 border-dashed border-success-300 rounded-lg p-6 hover:bg-success-100 transition-colors text-center dark:hover:bg-success-900/30">
                        <Upload className="w-8 h-8 text-success-600 mx-auto mb-2" />
                        <p className="text-sm font-medium text-success-900">
                          Upload Photo
                        </p>
                      </div>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Analyze Button */}
            <Button
              type="button"
              onClick={handleAnalyze}
              disabled={!description.trim() || analyzing}
              className="w-full bg-success-600"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Invoice Items
                </>
              )}
            </Button>
          </>
        ) : (
          <>
            {/* AI Results */}
            <div className="space-y-4">
              {/* Photo Preview */}
              {photoPreview && (
                <div>
                  <img
                    src={photoPreview}
                    alt="Job site"
                    className="w-full h-32 object-cover rounded-lg border-2 border-success-200"
                  />
                </div>
              )}
              <div>
                <p className="text-sm text-success-700 mt-1">
                  <strong>Description:</strong> {description}
                </p>
              </div>

              {/* Materials List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-success-900">
                    Estimated Materials
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddMaterial}
                  >
                    Add Material
                  </Button>
                </div>
                <div className="space-y-2">
                  {editedMaterials.map((material, index) => (
                    <div
                      key={index}
                      className="space-y-2 bg-surface p-3 rounded border border-success-200 dark:bg-surface-inverted"
                    >
                      <div className="flex gap-2 items-center">
                        <Input
                          placeholder="Material name"
                          value={material.name}
                          onChange={(e) =>
                            handleMaterialChange(index, "name", e.target.value)
                          }
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveMaterial(index)}
                        >
                          <X className="w-4 h-4 text-danger-500" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <Input
                          type="number"
                          placeholder="Qty"
                          value={material.quantity}
                          onChange={(e) =>
                            handleMaterialChange(
                              index,
                              "quantity",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                        />
                        <Input
                          placeholder="Unit"
                          value={material.unit}
                          onChange={(e) =>
                            handleMaterialChange(index, "unit", e.target.value)
                          }
                        />
                        <Input
                          type="number"
                          placeholder="Price/Unit"
                          value={material.price_per_unit || 0}
                          onChange={(e) =>
                            handleMaterialChange(
                              index,
                              "price_per_unit",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                        />
                        <Input
                          type="number"
                          placeholder="Total"
                          value={(material.total_cost || 0).toFixed(2)}
                          disabled
                          className="bg-ink-100 dark:bg-ink-800"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Labor Hours */}
              <div>
                <Label htmlFor="labor_hours" className="text-success-900">
                  Estimated Labor Hours
                </Label>
                <Input
                  id="labor_hours"
                  type="number"
                  min="0"
                  step="0.5"
                  value={editedLaborHours}
                  onChange={(e) =>
                    setEditedLaborHours(parseFloat(e.target.value) || 0)
                  }
                  className="mt-1"
                />
              </div>

              {/* Estimated Total */}
              {aiResults.estimated_total > 0 && (
                <div className="bg-success-100 border border-success-300 rounded-lg p-4 dark:bg-success-900/30">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-success-900">
                      Materials Subtotal:
                    </span>
                    <span className="text-lg font-bold text-success-900">
                      ${aiResults.materials_subtotal?.toFixed(2) || "0.00"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-success-900">
                      Labor ({editedLaborHours}h × $
                      {aiResults.labor_rate?.toFixed(0) || 0}/h):
                    </span>
                    <span className="text-lg font-bold text-success-900">
                      ${aiResults.labor_total?.toFixed(2) || "0.00"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-success-300">
                    <span className="text-base font-bold text-success-900">
                      Estimated Total:
                    </span>
                    <span className="text-2xl font-bold text-success-900">
                      ${aiResults.estimated_total?.toFixed(2) || "0.00"}
                    </span>
                  </div>
                </div>
              )}

              {/* AI Notes */}
              {aiResults.notes && (
                <div className="bg-success-100 border border-success-200 rounded-lg p-3 dark:bg-success-900/30 dark:border-success-800/50">
                  <p className="text-sm text-success-900 font-medium mb-1">
                    AI Recommendations:
                  </p>
                  <p className="text-sm text-success-800">{aiResults.notes}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  className="flex-1"
                >
                  Start Over
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirm}
                  className="flex-1 bg-success-600"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Use This Analysis
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
