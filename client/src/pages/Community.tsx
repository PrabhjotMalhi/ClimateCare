import { useQueryClient } from "@tanstack/react-query";
import CommunityForm from "@/components/CommunityForm";
import CommunityFeed from "@/components/CommunityFeed";
import type { InsertCommunitySubmission } from "@shared/schema";

export default function CommunityPage() {
  const queryClient = useQueryClient();

  const handleSubmission = async (data: InsertCommunitySubmission) => {
    try {
      const response = await fetch("/api/community/submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to submit report");
      }

      // Invalidate and refetch submissions
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
    } catch (error) {
      console.error("Error submitting report:", error);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Community Reports</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <CommunityForm onSubmit={handleSubmission} />
        <CommunityFeed className="md:min-h-[600px]" />
      </div>
    </div>
  );
}