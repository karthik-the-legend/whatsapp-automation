import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createStudentAction } from './actions';

interface Batch {
  id: string;
  name: string;
}

interface Student {
  id: string;
  name: string;
  parentName?: string | null;
  phone: string;
  beltLevel?: string | null;
  status: string;
  batch?: { id: string; name: string } | null;
}

interface SearchResult {
  items: Student[];
  total: number;
  page: number;
  pageSize: number;
}

const statusVariant: Record<string, 'success' | 'secondary' | 'outline'> = {
  ACTIVE: 'success',
  TRIAL: 'outline',
  INACTIVE: 'secondary',
};

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ text?: string; batchId?: string; status?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.text) query.set('text', params.text);
  if (params.batchId) query.set('batchId', params.batchId);
  if (params.status) query.set('status', params.status);

  const [result, batches] = await Promise.all([
    apiFetch<SearchResult>(`/api/v1/students?${query.toString()}`),
    apiFetch<Batch[]>('/api/v1/batches'),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Students</h1>
        <p className="text-sm text-muted-foreground">{result.total} total</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="text">Search</Label>
              <Input id="text" name="text" placeholder="Name, parent, or phone" defaultValue={params.text} className="w-56" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="batchId">Batch</Label>
              <Select id="batchId" name="batchId" defaultValue={params.batchId ?? ''} className="w-40">
                <option value="">All batches</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue={params.status ?? ''} className="w-36">
                <option value="">Any</option>
                <option value="ACTIVE">Active</option>
                <option value="TRIAL">Trial</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
            </div>
            <Button type="submit">Filter</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Parent</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead>Belt</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.map((student) => (
              <TableRow key={student.id}>
                <TableCell className="font-medium">{student.name}</TableCell>
                <TableCell>{student.parentName ?? '—'}</TableCell>
                <TableCell>{student.phone}</TableCell>
                <TableCell>{student.batch?.name ?? '—'}</TableCell>
                <TableCell>{student.beltLevel ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[student.status] ?? 'secondary'}>{student.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
            {result.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No students match this filter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add a student</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createStudentAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">WhatsApp phone</Label>
              <Input id="phone" name="phone" placeholder="+91..." required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="parentName">Parent name</Label>
              <Input id="parentName" name="parentName" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="beltLevel">Belt level</Label>
              <Input id="beltLevel" name="beltLevel" placeholder="White, Yellow, ..." />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="createBatchId">Batch</Label>
              <Select id="createBatchId" name="batchId" defaultValue="">
                <option value="">Unassigned</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-end">
              <Button type="submit">Add student</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
