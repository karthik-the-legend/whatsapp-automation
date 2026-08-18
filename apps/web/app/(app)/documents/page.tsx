import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { uploadDocumentAction, sendDocumentAction } from './actions';

interface DocumentAsset {
  id: string;
  name: string;
  type: string;
  mediaId?: string | null;
  fileUrl?: string | null;
  createdAt: string;
}

const DOCUMENT_TYPES = [
  'ADMISSION_FORM',
  'ACADEMY_RULES',
  'FEE_STRUCTURE',
  'UNIFORM_INFO',
  'BELT_SYLLABUS',
  'EVENT_BROCHURE',
  'TOURNAMENT_FORM',
  'TRAINING_SCHEDULE',
];

export default async function DocumentsPage() {
  const documents = await apiFetch<DocumentAsset[]>('/api/v1/documents');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Documents</h1>
        <p className="text-sm text-muted-foreground">Admission forms, syllabus, and other files sent to parents over WhatsApp.</p>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Uploaded</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell className="font-medium">{doc.name}</TableCell>
                <TableCell>{doc.type}</TableCell>
                <TableCell>{new Date(doc.createdAt).toLocaleDateString('en-IN')}</TableCell>
              </TableRow>
            ))}
            {documents.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                  No documents uploaded yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upload a document</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={uploadDocumentAction} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" placeholder="Admission Form 2026" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="type">Type</Label>
                <Select id="type" name="type" defaultValue={DOCUMENT_TYPES[0]}>
                  {DOCUMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.replace(/_/g, ' ')}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="file">File</Label>
                <input id="file" name="file" type="file" required className="text-sm" />
              </div>
              <Button type="submit">Upload</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Send to a parent</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={sendDocumentAction} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="phone">WhatsApp phone</Label>
                <Input id="phone" name="phone" placeholder="+91..." required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sendType">Document type</Label>
                <Select id="sendType" name="type" defaultValue={DOCUMENT_TYPES[0]}>
                  {DOCUMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.replace(/_/g, ' ')}
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit">Send latest of this type</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
