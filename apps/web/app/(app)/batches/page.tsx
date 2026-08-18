import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { createBatchAction } from './actions';

interface Batch {
  id: string;
  name: string;
  daysOfWeek: number[];
  classStartTime: string;
  feeAmount: number;
  feeCycle: string;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatInr(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

export default async function BatchesPage() {
  const batches = await apiFetch<Batch[]>('/api/v1/batches');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Batches</h1>
        <p className="text-sm text-muted-foreground">{batches.length} total</p>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Start time</TableHead>
              <TableHead>Fee</TableHead>
              <TableHead>Cycle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.map((batch) => (
              <TableRow key={batch.id}>
                <TableCell className="font-medium">{batch.name}</TableCell>
                <TableCell>{batch.daysOfWeek.map((d) => DAY_LABELS[d]).join(', ')}</TableCell>
                <TableCell>{batch.classStartTime}</TableCell>
                <TableCell>{formatInr(batch.feeAmount)}</TableCell>
                <TableCell>{batch.feeCycle}</TableCell>
              </TableRow>
            ))}
            {batches.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No batches yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add a batch</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createBatchAction} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" placeholder="Evening Kids Kickboxing" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="classStartTime">Start time (24h)</Label>
                <Input id="classStartTime" name="classStartTime" placeholder="17:00" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="feeAmount">Fee (₹)</Label>
                <Input id="feeAmount" name="feeAmount" type="number" min={0} step="0.01" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="feeCycle">Fee cycle</Label>
                <Select id="feeCycle" name="feeCycle" defaultValue="MONTHLY">
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Days of week</Label>
              <div className="flex flex-wrap gap-3">
                {DAY_LABELS.map((label, index) => (
                  <label key={label} className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" name="daysOfWeek" value={index} className="h-4 w-4 rounded border-border" />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Button type="submit">Add batch</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
