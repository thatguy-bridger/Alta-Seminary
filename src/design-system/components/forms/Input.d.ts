export interface InputProps {
  label?: string;
  placeholder?: string;
  type?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  helpText?: string;
  error?: string;
}
export declare function Input(props: InputProps): JSX.Element;
