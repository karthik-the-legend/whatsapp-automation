import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/lib/api';

interface OutstandingPayments {
  totalOutstanding: number;
  count: number;
}

interface ChatbotPerformance {
  totalConversations: number;
  escalatedConversations: number;
  autoResolvedRate: number;
}

interface StudentGrowthPoint {
  month: string;
  count: number;
}

function formatInr(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

function toDateParam(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default async function OverviewPage() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 29);
  const range = `from=${toDateParam(from)}&to=${toDateParam(to)}`;

  const [dailyEnquiries, admissions, feeCollection, outstanding, chatbot, growth] = await Promise.all([
    apiFetch<{ count: number }>('/api/v1/analytics/daily-enquiries'),
    apiFetch<{ count: number }>('/api/v1/analytics/admissions-this-month'),
    apiFetch<{ amountPaid: number }>('/api/v1/analytics/fee-collection-this-month'),
    apiFetch<OutstandingPayments>('/api/v1/analytics/outstanding-payments'),
    apiFetch<ChatbotPerformance>(`/api/v1/analytics/chatbot-performance?${range}`),
    apiFetch<StudentGrowthPoint[]>('/api/v1/analytics/student-growth?months=6'),
  ]);

  const maxGrowth = Math.max(1, ...growth.map((g) => g.count));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground">Last 30 days, unless noted otherwise.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Enquiries today</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{dailyEnquiries.count}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Admissions this month</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{admissions.count}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Fees collected this month</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{formatInr(feeCollection.amountPaid)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Outstanding fees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{formatInr(outstanding.totalOutstanding)}</div>
            <div className="text-xs text-muted-foreground">{outstanding.count} payment(s) pending</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Chatbot performance (last 30 days)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Conversations</span>
              <span className="text-xl font-semibold">{chatbot.totalConversations}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Escalated to a human</span>
              <span className="text-xl font-semibold">{chatbot.escalatedConversations}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Auto-resolved rate</span>
              <span className="text-xl font-semibold">{chatbot.autoResolvedRate}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Student growth (last 6 months)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {growth.map((point) => (
              <div key={point.month} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-xs text-muted-foreground">{point.month}</span>
                <div className="h-2 flex-1 rounded-full bg-secondary">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${(point.count / maxGrowth) * 100}%` }} />
                </div>
                <span className="w-6 shrink-0 text-right text-xs font-medium">{point.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
