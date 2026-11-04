/**
 * Shared component types
 */

export interface IssuesPanelProps {
  issues: any[];
  selectedIssue: any | null;
  onIssueClick: (issue: any) => void;
  onClose: () => void;
  mobile?: boolean;
  month?: string;
}

export interface SuggestionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  issue: any | null;
  month: string;
  onApply: (suggestionId: string) => void;
  loading: boolean;
}