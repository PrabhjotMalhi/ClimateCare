import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CommunitySubmission } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

interface CommunityFeedProps {
  className?: string;
}

export default function CommunityFeed({ className }: CommunityFeedProps) {
  const [submissions, setSubmissions] = useState<CommunitySubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        const response = await fetch("/api/community/submissions");
        if (!response.ok) throw new Error("Failed to fetch submissions");
        const data = await response.json();
        setSubmissions(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load submissions");
      } finally {
        setLoading(false);
      }
    };

    // Set up WebSocket connection for real-time updates
    const wsUrl = `ws://${window.location.hostname}:3001`;
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('Connected to community WebSocket server');
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "new_submission") {
        setSubmissions(prev => [data.submission, ...prev]);
      }
    };

    fetchSubmissions();

    return () => {
      ws.close();
    };
  }, []);

  if (loading) {
    return (
      <Card className={`p-4 ${className}`}>
        <p className="text-center text-muted-foreground">Loading submissions...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`p-4 ${className}`}>
        <p className="text-center text-destructive">{error}</p>
      </Card>
    );
  }

  return (
    <Card className={`${className}`}>
      <div className="p-4 border-b">
        <h3 className="font-semibold">Recent Community Reports</h3>
      </div>
      <ScrollArea className="h-[500px] p-4">
        {submissions.length === 0 ? (
          <p className="text-center text-muted-foreground">No submissions yet. Be the first to report!</p>
        ) : (
          <div className="space-y-4">
            {submissions.map((submission) => (
              <Card key={submission.id} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium">{submission.location}</h4>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(submission.timestamp), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{submission.message}</p>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
}