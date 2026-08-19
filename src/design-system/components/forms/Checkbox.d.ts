export interface CheckboxProps {
  label: string;
  checked?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}
export declare function Checkbox(props: CheckboxProps): JSX.Element;
