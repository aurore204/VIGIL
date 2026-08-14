import type { ReleaseStep, TeamMember } from "@/lib/types";
import { CheckCircle2 } from "lucide-react";

interface StepListProps {
  steps: ReleaseStep[];
  members: TeamMember[];
}

const stepColors: Record<string, string> = {
  completed: "oklch(0.72 0.14 150)",
  in_progress: "oklch(0.66 0.16 255)",
  pending: "oklch(0.27 0.015 260)",
  cancelled: "oklch(0.45 0.01 260)",
};

function resolveUsername(
  userId: string | null,
  members: TeamMember[],
): string | null {
  if (!userId) return null;
  return members.find((m) => m.user_id === userId)?.username ?? userId;
}

export function StepList({ steps, members }: StepListProps) {
  return (
    <div
      style={{
        marginTop: "14px",
        marginBottom: "8px",
        display: "flex",
        gap: "4px",
      }}
    >
      {steps.map((step) => {
        const validator = resolveUsername(step.validated_by, members);
        return (
          <div
            key={step.id}
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div
              title={step.name}
              style={{
                height: "6px",
                borderRadius: "3px",
                background: stepColors[step.state] ?? stepColors.pending,
              }}
            />
            <span
              style={{
                fontSize: "10px",
                color: "oklch(0.55 0.01 260)",
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {step.name}
            </span>
            {validator && (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "3px",
                  fontSize: "10px",
                  color: "oklch(0.72 0.14 150)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                <CheckCircle2
                  size={10}
                  aria-hidden="true"
                  style={{ flexShrink: 0 }}
                />
                {validator}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
