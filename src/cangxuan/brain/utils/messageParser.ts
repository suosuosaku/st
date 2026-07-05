import { extractCangxuanReadableContent } from './cangxuanParser';

/**
 * 从AI消息中提取正文内容，并前置 <time> 标签信息
 */
export function extractContentFromMessage(messageText: string): string {
  return extractCangxuanReadableContent(messageText).content;
}
