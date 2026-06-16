import { FileImage, Film, Upload } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { fileName, fileUrl } from "../lib/utils";

interface Props {
  label: string;
  type: "image" | "video";
  path?: string;
  optional?: boolean;
  onSelect: () => void;
}

export function AssetPreview({
  label,
  type,
  path,
  optional,
  onSelect,
}: Props): JSX.Element {
  return (
    <Card className="overflow-hidden">
      <div className="flex h-44 items-center justify-center bg-black/30">
        {path && type === "image" ? (
          <img src={fileUrl(path)} className="h-full w-full object-contain" />
        ) : null}
        {path && type === "video" ? (
          <video
            src={fileUrl(path)}
            className="h-full w-full object-contain"
            controls
          />
        ) : null}
        {!path ? (
          <div className="text-center text-muted-foreground">
            {type === "image" ? (
              <FileImage className="mx-auto mb-2 h-9 w-9" />
            ) : (
              <Film className="mx-auto mb-2 h-9 w-9" />
            )}
            <div className="text-sm">{optional ? "Optional" : "Required"}</div>
          </div>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="font-medium">{label}</p>
          <p className="truncate text-xs text-muted-foreground">
            {path
              ? fileName(path)
              : type === "image"
                ? "JPG, JPEG, PNG"
                : "MP4, MOV"}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={onSelect}>
          <Upload className="h-4 w-4" /> Select
        </Button>
      </div>
    </Card>
  );
}
