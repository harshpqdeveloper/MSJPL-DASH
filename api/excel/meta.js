import {
  handleExcelMeta,
  resolveExcelDir
} from "../../lib/excelFile.js";

export const config = {
  includeFiles: "excel/**"
};

export default async function handler(
  req,
  res
) {

  const excelDir =
    resolveExcelDir(
      process.cwd()
    );

  return handleExcelMeta(
    req,
    res,
    excelDir
  );
}