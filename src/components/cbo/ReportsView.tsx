import { CBOReports } from './CBOReports';

export function ReportsView({
  orgId,
}: {
  orgId: string | null;
}) {
  return <CBOReports orgId={orgId} />;
}

