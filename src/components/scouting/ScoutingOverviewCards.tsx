import { Clock, Eye, User } from "lucide-react";

import type { StaffData } from "../../store/gameStore";
import { Card, CardBody } from "../ui";

interface ScoutingOverviewCardsProps {
  scouts: StaffData[];
  assignmentCount: number;
  availableScoutCount: number;
  totalCapacity: number;
  labels: {
    scouts: string;
    activeAssignments: string;
    freeSlots: string;
  };
}

export default function ScoutingOverviewCards({
  scouts,
  assignmentCount,
  availableScoutCount,
  totalCapacity,
  labels,
}: ScoutingOverviewCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardBody>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-panel bg-warning-tint flex items-center justify-center">
              <Eye className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-caption text-fg-muted font-heading uppercase tracking-label">
                {labels.scouts}
              </p>
              <p className="text-title font-heading font-bold text-fg">{scouts.length}</p>
            </div>
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-panel bg-selected-tint flex items-center justify-center">
              <Clock className="w-5 h-5 text-selected" />
            </div>
            <div>
              <p className="text-caption text-fg-muted font-heading uppercase tracking-label">
                {labels.activeAssignments}
              </p>
              <p className="text-title font-heading font-bold text-fg">
                {assignmentCount} / {totalCapacity}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-panel bg-positive-tint flex items-center justify-center">
              <User className="w-5 h-5 text-positive" />
            </div>
            <div>
              <p className="text-caption text-fg-muted font-heading uppercase tracking-label">
                {labels.freeSlots}
              </p>
              <p className="text-title font-heading font-bold text-fg">{availableScoutCount}</p>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
