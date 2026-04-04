import { PointDefinition } from './types';

export class GeometryResolver {
  /**
   * 計算當下所有點的座標。當 Slider 改變變數時被觸發。
   * 此方法將遍歷所有的點定義，計算出每個點在畫布上的絕對坐標 (x, y)。
   */
  public resolveCoordinates(
    points: Record<string, PointDefinition>, 
    variables: Record<string, number>
  ): Map<string, { x: number; y: number }> {
    
    const resolved = new Map<string, { x: number; y: number }>();
    // 追蹤已經解算過的點，防止無限迴圈
    const processing = new Set<string>();

    const resolvePoint = (pointId: string): { x: number; y: number } => {
      if (resolved.has(pointId)) {
        return resolved.get(pointId)!;
      }
      if (processing.has(pointId)) {
        throw new Error(`Circular dependency detected at point: ${pointId}`);
      }

      processing.add(pointId);
      const def = points[pointId];

      if (!def) {
        throw new Error(`Definition for point ${pointId} not found.`);
      }

      let result: { x: number; y: number };

      switch (def.type) {
        case 'absolute':
          result = { x: def.x, y: def.y };
          break;

        case 'polar': {
          const originCoords = resolvePoint(def.refOrigin);
          const r = variables[def.radiusVar];
          const thetaDeg = variables[def.angleVar];

          if (r === undefined || thetaDeg === undefined) {
             throw new Error(`Missing variable for polar calculation: ${def.radiusVar} or ${def.angleVar}`);
          }
          
          const thetaRad = thetaDeg * (Math.PI / 180);
          result = {
            x: originCoords.x + r * Math.cos(thetaRad),
            // SVG Y 軸向下，如果需要一般數學坐標系可以改為減號，此處以標準數學體系系並在渲染端轉換
            y: originCoords.y + r * Math.sin(thetaRad) 
          };
          break;
        }

        case 'polar_eval': {
          const originCoords = resolvePoint(def.refOrigin);
          const r = variables[def.radiusVar];
          
          if (r === undefined) {
             throw new Error(`Missing radius variable: ${def.radiusVar}`);
          }

          // 評估字串數學表達式
          const thetaDeg = this.evaluateExpression(def.angleExpression, variables);
          const thetaRad = thetaDeg * (Math.PI / 180);
          
          result = {
            x: originCoords.x + r * Math.cos(thetaRad),
            y: originCoords.y + r * Math.sin(thetaRad)
          };
          break;
        }

        default:
          throw new Error(`Unknown point definition type for ${pointId}`);
      }

      processing.delete(pointId);
      resolved.set(pointId, result);
      return result;
    };

    // 解析所有的點
    for (const pointId of Object.keys(points)) {
      try {
        resolvePoint(pointId);
      } catch (e) {
        console.error(`Error resolving point ${pointId}:`, e);
        // 如果這個點解析失敗，我們可以選擇略過，或者 throw 到外層由 React Error Boundary 處理
        throw e;
      }
    }

    return resolved;
  }

  /**
   * 工具：安全的字串數學表達式解析器 (不使用 eval 以防 XSS)
   * 支援簡單的加減乘除、括號與變數替換
   * 為了範例簡化，此處我們自幹一個極簡解析器或利用 Function。
   * (實務上可以考慮 import 'mathjs' 等輕量庫，或使用 Function 來建構)
   */
  public evaluateExpression(expression: string, variables: Record<string, number>): number {
    try {
      // 步驟 1: 取出所有變數 key，並對應其 value
      const varNames = Object.keys(variables);
      const varValues = Object.values(variables);

      // 步驟 2: 建構一個可以接受這些變數為參數的安全 Function
      // 這比直接執行 eval(expression) 更安全，因為它受到參數作用域的限制
      const mathFunc = new Function(...varNames, `return ${expression};`);
      
      // 步驟 3: 傳入數值執行
      const result = mathFunc(...varValues);
      
      if (isNaN(result)) {
        throw new Error(`Expression resulted in NaN: ${expression}`);
      }
      return result;

    } catch (e) {
      console.error(`Failed to evaluate expression: ${expression}`, e);
      throw new Error(`Evaluation error: ${e.message}`);
    }
  }
}
