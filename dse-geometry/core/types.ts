export interface QuestionData {
  geometry_state: GeometryState;
  question_template: QuestionTemplate;
  marking_scheme: MarkingScheme;
  controls: UIControls;
}

export interface GeometryState {
  // 核心變數庫 (sliders 即時修改的值)
  variables: Record<string, number>;
  
  // 點的定義 (基於相對約束)
  points: {
    [pointId: string]: PointDefinition;
  };
  
  // 繪製元素定義 (線段、圓、弧、標籤)
  elements: {
    lines?: Array<{ from: string; to: string; conditionalToggle?: string }>;
    circles?: Array<{ center: string; radiusVar: string }>;
    arcs?: Array<{ center: string; from: string; to: string; radius: number }>;
    labels?: Array<{ point: string; text: string; offset: { x: number; y: number } }>;
  };
}

export type PointDefinition = 
  | { type: 'absolute'; x: number; y: number }
  | { type: 'polar'; refOrigin: string; radiusVar: string; angleVar: string }
  | { type: 'polar_eval'; refOrigin: string; radiusVar: string; angleExpression: string };

export interface QuestionTemplate {
  // 支援 KaTeX 語法與雙大括號變數注入
  text: string;
}

export interface MarkingScheme {
  steps: Array<{
    description: string;
    marks: number;
    markType: 'M' | 'A';
  }>;
}

export interface UIControls {
  sliders: Array<{
    targetVariable: string;
    label: string;
    min: number;
    max: number;
    step: number;
  }>;
  toggles: Array<{
    id: string;
    label: string;
    defaultValue: boolean;
  }>;
}
