"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Dispatch, ReactNode, SetStateAction, useState } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import NewPlanForm from "@/components/NewPlanForm";
import { Backpack } from "lucide-react";

export const GeneratePlanDrawerWithDialog = () => {
  const dialogTriggerBtn = (
    <Button
      aria-label={`open dialog button for Create Travel Plan`}
      className="bg-blue-500  hover:bg-blue-600 text-white flex gap-1 justify-center items-center"
    >
      <Backpack className="h-4 w-4" />
      <span>Create Travel Plan</span>
    </Button>
  );
  return (
    <DrawerWithDialog dialogTriggerBtn={dialogTriggerBtn}>
      {({ setOpen }) => (
        <>
          <DialogHeader>
            <DialogTitle>Create Travel Plan</DialogTitle>
          </DialogHeader>
          <NewPlanForm closeModal={setOpen} />
        </>
      )}
    </DrawerWithDialog>
  );
};

const DrawerWithDialog = ({
  dialogTriggerBtn,
  children,
}: {
  dialogTriggerBtn: ReactNode;
  children:
    | React.ReactNode
    | ((props: {
        setOpen: Dispatch<SetStateAction<boolean>>;
      }) => React.ReactNode);
}) => {
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const renderContent = () => {
    if (typeof children === "function") {
      return children({ setOpen });
    }
    return children;
  };

  if (isDesktop) {
    return (
      <>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>{dialogTriggerBtn}</DialogTrigger>
          <DialogContent className="max-w-xl">{renderContent()}</DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{dialogTriggerBtn}</DrawerTrigger>
      <DrawerContent className="max-h-[90vh] p-5">
        <div className="flex max-h-[calc(90vh-2rem)] flex-col overflow-y-auto">
          {renderContent()}
        </div>
        
      </DrawerContent>
    </Drawer>
  );
};

export default DrawerWithDialog;
