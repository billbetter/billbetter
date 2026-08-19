import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Package } from "lucide-react";

export default function MaterialInputCard({ materials, setMaterials }) {
  const addMaterialField = () => {
    setMaterials([...materials, ""]);
  };

  const removeMaterialField = (index) => {
    if (materials.length > 1) {
      setMaterials(materials.filter((_, i) => i !== index));
    }
  };

  const updateMaterial = (index, value) => {
    const updated = [...materials];
    updated[index] = value;
    setMaterials(updated);
  };

  return (
    <Card className="border-none shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5 text-aqua-600" />
          Materials to Compare
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {materials.map((material, index) => (
          <div key={index} className="flex gap-2">
            <Input
              value={material}
              onChange={(e) => updateMaterial(index, e.target.value)}
              placeholder={`Material ${index + 1} (e.g., 2x4x8 lumber)`}
              className="flex-1"
            />
            {materials.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeMaterialField(index)}
                className="text-danger-700 hover:text-danger-700 hover:bg-danger-50 dark:text-danger-400 dark:hover:text-danger-400 dark:hover:bg-danger-900/20"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        ))}

        <Button
          variant="outline"
          onClick={addMaterialField}
          className="w-full border-dashed"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Material
        </Button>
      </CardContent>
    </Card>
  );
}
