export interface TabsProps {
  tabs: string[];
  active: string;
  onChange?: (tab: string) => void;
}
export declare function Tabs(props: TabsProps): JSX.Element;
