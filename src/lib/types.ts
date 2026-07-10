export interface ReportListItem {
  id: string;
  referenceNo: string;
  title: string;
  description: string | null;
  latitude: number;
  longitude: number;
  severity: number | null;
  status: string;
  category: string | null;
  subcategory: string | null;
  postAction: string | null;
  postType: string | null;
  parentReportId: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  audioUrl: string | null;
  aiSummary: string | null;
  featured: boolean;
  createdAt: string;
  submitterId: string;
  userDisplayName: string | null;
  userEmail: string | null;
  upvoteCount: number;
  commentCount: number;
  userHasUpvoted: boolean;
}
