"use client";
import SectionWrapper from "@/components/sections/SectionWrapper";

import {Skeleton} from "@/components/ui/skeleton";
import {Info} from "lucide-react";
import {useState} from "react";
import EditText from "@/components/shared/EditText";
import HeaderWithEditIcon from "@/components/shared/HeaderWithEditIcon";
import {updatePartOfPlan} from "@/lib/client/plan";

type AboutThePlaceProps = {
  content: string | undefined;
  isLoading: boolean;
  planId: string;
  allowEdit: boolean;
};

export default function AboutThePlace({content, isLoading, planId, allowEdit}: AboutThePlaceProps) {
  const [editMode, setEditMode] = useState(false);

  const handleToggleEditMode = () => {
    setEditMode(!editMode);
  };

  const updateAboutThePlaceContent = (updatedContent: string) => {
    updatePartOfPlan(planId, "abouttheplace", updatedContent.trim()).then(() => {
      handleToggleEditMode();
    });
  };

  return (
    <SectionWrapper id="abouttheplace">
      <HeaderWithEditIcon
        shouldShowEditIcon={!editMode && allowEdit}
        handleToggleEditMode={handleToggleEditMode}
        hasData={typeof content === "string" && content.length > 0}
        icon={<Info className="mr-2" />}
        title="About the Place"
        isLoading={isLoading}
      />
      <div className="ml-8">
        {!isLoading ? (
          editMode ? (
            <EditText
              content={content ?? ""}
              toggleEditMode={handleToggleEditMode}
              updateContent={updateAboutThePlaceContent}
            />
          ) : (
            content || (
              <div className=" flex justify-center items-center">
                Click + to add about the place
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
