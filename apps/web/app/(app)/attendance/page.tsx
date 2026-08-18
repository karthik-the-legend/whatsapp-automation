import { apiFetch } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { markAttendanceAction } from './actions';

interface Batch {
  id: string;
  name: string;
}

interface Student {
  id: string;
  name: string;
  phone: string;
}

interface AttendanceRecord {
  studentId: string;
  status: 'PRESENT' | 'ABSENT';
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ batchId?: string; date?: string }>;
}) {
  const params = await searchParams;
  const date = params.date ?? today();
  const batches = await apiFetch<Batch[]>('/api/v1/batches');
  const batchId = params.batchId ?? batches[0]?.id ?? '';

  const [roster, records] = batchId
    ? await Promise.all([
        apiFetch<{ items: Student[] }>(`/api/v1/students?batchId=${batchId}&pageSize=100`),
        apiFetch<AttendanceRecord[]>(`/api/v1/attendance?batchId=${batchId}&date=${date}`),
      ])
    : [{ items: [] as Student[] }, [] as AttendanceRecord[]];

  const statusByStudent = new Map(records.map((r) => [r.studentId, r.status]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Attendance</h1>
        <p className="text-sm text-muted-foreground">Mark today&apos;s class, or look up any past date.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="batchId">Batch</Label>
              <Select id="batchId" name="batchId" defaultValue={batchId} className="w-56">
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="date">Date</Label>
              <Input id="date" name="date" type="date" defaultValue={date} className="w-44" />
            </div>
            <Button type="submit">Go</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Mark</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roster.items.map((student) => {
              const status = statusByStudent.get(student.id);
              return (
                <TableRow key={student.id}>
                  <TableCell className="font-medium">{student.name}</TableCell>
                  <TableCell>{student.phone}</TableCell>
                  <TableCell>
                    {status ? (
                      <Badge variant={status === 'PRESENT' ? 'success' : 'destructive'}>{status}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not marked</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <form action={markAttendanceAction} className="flex items-center gap-2">
                      <input type="hidden" name="studentId" value={student.id} />
                      <input type="hidden" name="batchId" value={batchId} />
                      <input type="hidden" name="date" value={date} />
                      <Select name="status" defaultValue={status ?? 'PRESENT'} className="h-8 w-32">
                        <option value="PRESENT">Present</option>
                        <option value="ABSENT">Absent</option>
                      </Select>
                      <Button type="submit" size="sm" variant="outline">
                        Save
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              );
            })}
            {roster.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  {batchId ? 'No students in this batch.' : 'No batches yet — add one first.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
