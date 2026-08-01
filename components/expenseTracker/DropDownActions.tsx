import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {Button} from "@/components/ui/button";
import {DotsHorizontalIcon} from "@radix-ui/react-icons";
import {Row} from "@tanstack/react-table";
import type {Expense} from "@prisma/client";
import {deleteExpense as deleteExpenseRequest} from "@/lib/client/plan";
import {mutate} from "swr";
import {Trash2Icon} from "lucide-react";

const DropDownActions = ({row}: {row: Row<Expense & {whoSpent: string}>}) => {
  const handleDelete = async () => {
    await deleteExpenseRequest(row.original.id);
    mutate((key) => typeof key === "string" && key.endsWith("/expenses"));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <DotsHorizontalIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem onClick={handleDelete}>
          <Trash2Icon className="w-4 h-4 text-red-500 mr-2" />
          <span>Delete Expense</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default DropDownActions;
