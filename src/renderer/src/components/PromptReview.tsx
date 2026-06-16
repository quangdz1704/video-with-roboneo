import type { PromptPack } from "@shared/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";

interface Props {
  pack: PromptPack;
  finalPrompt: string;
  onChange: (value: string) => void;
}

export function PromptReview({
  pack,
  finalPrompt,
  onChange,
}: Props): JSX.Element {
  return (
    <div className="grid gap-5 xl:grid-cols-[1.4fr_0.6fr]">
      <Card>
        <CardHeader>
          <CardTitle>Final RoboNeo prompt</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={finalPrompt}
            onChange={(event) => onChange(event.target.value)}
            className="min-h-[430px] font-mono text-xs leading-5"
          />
        </CardContent>
      </Card>
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Caption pack</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">{pack.caption}</p>
            <div className="flex flex-wrap gap-2">
              {pack.hashtags.map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Prompt variations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pack.variations.map((variation, index) => (
              <button
                key={index}
                onClick={() => onChange(variation)}
                className="w-full rounded-lg border border-border p-3 text-left text-xs text-muted-foreground transition hover:border-primary hover:text-foreground"
              >
                Variation {index + 1}:{" "}
                {variation.split("Variation:")[1]?.slice(0, 100)}
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
