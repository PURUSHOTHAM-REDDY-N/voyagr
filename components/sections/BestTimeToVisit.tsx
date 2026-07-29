"use client";
import SectionWrapper from "@/components/sections/SectionWrapper";
import EditText from "@/components/shared/EditText";
import HeaderWithEditIcon from "@/components/shared/HeaderWithEditIcon";
import {Skeleton} from "@/components/ui/skeleton";
import {updatePartOfPlan} from "@/lib/client/plan";
import {Clock3} from "lucide-react";
import {useState} from "react";

type BestTimeToVisitProps = {
  content: string | undefined;
  isLoading: boolean;
  planId: string;
  allowEdit: boolean;
};

export default function BestTimeToVisit({
  content,
  isLoading,
  planId,
  allowEdit,
}: BestTimeToVisitProps) {
  const [editMode, setEditMode] = useState(false);

  const handleToggleEditMode = () => {
    setEditMode(!editMode);
  };

  const updateBestTimeToVisitContent = (updatedContent: string) => {
    updatePartOfPlan(planId, "besttimetovisit", updatedContent.trim()).then(() => {
      handleToggleEditMode();
    });
  };

  return (
    <SectionWrapper id="besttimetovisit">
      <HeaderWithEditIcon
        shouldShowEditIcon={!editMode && allowEdit}
        handleToggleEditMode={handleToggleEditMode}
        hasData={typeof content === "string" && content.length > 0}
        icon={<Clock3 className="mr-2" />}
        title="Best Time To Visit"
        isLoading={isLoading}
      />
      <div className="ml-8">
        {!isLoading ? (
          editMode ? (
            <EditText
              content={content ?? ""}
              toggleEditMode={handleToggleEditMode}
              updateContent={updateBestTimeToVisitContent}
            />
          ) : (
            content || (
              <div className=" flex justify-center items-center">
                Click + to add best time to visit
              </div>
            )
          )
        ) : (
          <Skeleton className="w-full h-full" />
        )}
      </div>
    </SectionWrapper>
  );
}
