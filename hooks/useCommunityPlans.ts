import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/fetcher";

type PageResult = { items: any[]; nextCursor: string | null };

/** Replaces Convex's usePaginatedQuery(api.communityPlans.paginatedPublishedPlans, ...). */
export function useCommunityPlans(companion: string | undefined, pageSize = 8) {
  const getKey = (pageIndex: number, previousPageData: PageResult | null) => {
    if (previousPageData && !previousPageData.nextCursor) return null;

    const params = new URLSearchParams();
    if (companion) params.set("companion", companion);
    params.set("limit", String(pageSize));
    if (pageIndex > 0 && previousPageData?.nextCursor) {
      params.set("cursor", previousPageData.nextCursor);
    }
    return `/api/community-plans?${params.toString()}`;
  };

  const { data, size, setSize, isLoading, isValidating } = useSWRInfinite<PageResult>(
    getKey,
    fetcher
  );

  const results = data ? data.flatMap((page) => page.items) : [];
  const lastPage = data?.[data.length - 1];
  const isReachingEnd = Boolean(data && lastPage && !lastPage.nextCursor);

  let status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
  if (isLoading) status = "LoadingFirstPage";
  else if (isReachingEnd) status = "Exhausted";
  else if (isValidating) status = "LoadingMore";
  else status = "CanLoadMore";

  const loadMore = (_numItems?: number) => setSize(size + 1);

  return { results, status, loadMore };
}
