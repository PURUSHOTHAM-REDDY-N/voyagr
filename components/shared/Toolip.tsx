import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/components/ui/tooltip";
import {ComponentPropsWithoutRef, ElementRef, forwardRef, ReactNode} from "react";

type TooltipContainerProps = {
  text: string;
  children: ReactNode;
  key?: string;
} & Omit<ComponentPropsWithoutRef<typeof TooltipTrigger>, "children" | "asChild">;

export const TooltipContainer = forwardRef<
  ElementRef<typeof TooltipTrigger>,
  TooltipContainerProps
>(({text, children, key = "randomKey", ...props}, ref) => {
  return (
    <TooltipProvider key={key}>
      <Tooltip>
        <TooltipTrigger asChild ref={ref} {...props}>
          {children}
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-[200px]">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});
TooltipContainer.displayName = "TooltipContainer";
