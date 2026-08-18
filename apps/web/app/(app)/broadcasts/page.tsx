import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { sendBroadcastAction, announceHolidayAction, announceTournamentAction } from './actions';

interface BroadcastLog {
  id: string;
  segment: string;
  templateName: string;
  body: string;
  sentCount: number;
  failedCount: number;
  createdAt: string;
}

export default async function BroadcastsPage() {
  const recent = await apiFetch<BroadcastLog[]>('/api/v1/analytics/broadcast-delivery-status?limit=10');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Broadcasts</h1>
        <p className="text-sm text-muted-foreground">
          Sends a Meta-approved WhatsApp template to every student in the chosen segment.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Holiday notice</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={announceHolidayAction} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dateLabel">Date</Label>
                <Input id="dateLabel" name="dateLabel" placeholder="Aug 25" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reason">Reason</Label>
                <Input id="reason" name="reason" placeholder="Independence Day" required />
              </div>
              <Button type="submit">Announce to all students</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tournament announcement</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={announceTournamentAction} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="details">Details</Label>
                <Textarea id="details" name="details" placeholder="State-level tournament on Sept 5, registration open." required />
              </div>
              <Button type="submit">Announce to all students</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Custom broadcast</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={sendBroadcastAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="segment">Segment</Label>
              <Select id="segment" name="segment" defaultValue="ALL_STUDENTS">
                <option value="ALL_STUDENTS">All students</option>
                <option value="ACTIVE_STUDENTS">Active students</option>
                <option value="PENDING_FEES">Students with pending fees</option>
                <option value="PARENTS_ONLY">Parents only</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="templateName">Meta template name</Label>
              <Input id="templateName" name="templateName" placeholder="e.g. monthly_motivation" required />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="bodyPreview">Message preview (for the log — not sent as-is, the template is)</Label>
              <Textarea id="bodyPreview" name="bodyPreview" required />
            </div>
            <div>
              <Button type="submit">Send broadcast</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent broadcasts</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sent</TableHead>
              <TableHead>Segment</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Delivered</TableHead>
              <TableHead>Failed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recent.map((log) => (
              <TableRow key={log.id}>
                <TableCell>{new Date(log.createdAt).toLocaleString('en-IN')}</TableCell>
                <TableCell>{log.segment}</TableCell>
                <TableCell>{log.templateName}</TableCell>
                <TableCell>{log.sentCount}</TableCell>
                <TableCell>{log.failedCount}</TableCell>
              </TableRow>
            ))}
            {recent.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No broadcasts sent yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
