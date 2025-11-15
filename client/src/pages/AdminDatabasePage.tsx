import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";

type TableColumn = {
  name: string;
  type: string;
  notnull: boolean;
  pk: boolean;
  default_value?: string | null;
};

type TableData = {
  columns: TableColumn[];
  rows: Record<string, any>[];
  primaryKey: string | null;
};

const AdminDatabasePage = () => {
  const { token } = useAuth();
  const [passwordInput, setPasswordInput] = useState("");
  const [dbPassword, setDbPassword] = useState<string | null>(null);
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [loadingTable, setLoadingTable] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [editedRows, setEditedRows] = useState<Record<string, Record<string, any>>>({});
  const [savingRowKey, setSavingRowKey] = useState<string | null>(null);
  const [deletingRowKey, setDeletingRowKey] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRowData, setNewRowData] = useState<Record<string, any>>({});
  const [creatingRow, setCreatingRow] = useState(false);
  const [deletingTable, setDeletingTable] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvMode, setCsvMode] = useState<"overwrite" | "append">("overwrite");
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [showCsvForm, setShowCsvForm] = useState(false);
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (dbPassword && token) {
      fetchTables();
    }
  }, [dbPassword, token]);

  useEffect(() => {
    if (!selectedTable && tables.length > 0) {
      handleSelectTable(tables[0]);
    }
  }, [tables]);

  useEffect(() => {
    setShowCreateForm(false);
    setNewRowData({});
    setCsvFile(null);
    setShowCsvForm(false);
    if (csvInputRef.current) {
      csvInputRef.current.value = "";
    }
  }, [selectedTable]);

  const fetchTables = async () => {
    if (!token || !dbPassword) return;
    try {
      const data = await apiClient("/api/admin/database/tables", {
        token,
        headers: {
          "X-Database-Password": dbPassword,
        },
      });
      setTables(data.tables || []);
      setTableError(null);
    } catch (error: any) {
      setTableError(error?.message || "加载表列表失败");
    }
  };

  const handleCsvFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setCsvFile(file ?? null);
  };

  const fetchTableData = async (tableName: string) => {
    if (!token || !dbPassword) return;
    setLoadingTable(true);
    setTableError(null);
    setStatusMessage(null);
    try {
      const data = await apiClient(`/api/admin/database/tables/${encodeURIComponent(tableName)}`, {
        token,
        headers: {
          "X-Database-Password": dbPassword,
        },
      });
      setTableData({
        columns: data.columns || [],
        rows: data.rows || [],
        primaryKey: data.primary_key ?? null,
      });
      setEditedRows({});
      setShowCreateForm(false);
      setNewRowData({});
      setCreatingRow(false);
    } catch (error: any) {
      setTableError(error?.message || "加载表数据失败");
      setTableData(null);
    } finally {
      setLoadingTable(false);
    }
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    try {
      await apiClient("/api/admin/database/login", {
        method: "POST",
        token,
        body: JSON.stringify({ password: passwordInput }),
      });
      setDbPassword(passwordInput);
      setPasswordInput("");
      setLoginError(null);
      setStatusMessage(null);
    } catch (error: any) {
      setLoginError(error?.message || "密码错误");
    }
  };

  const handleSelectTable = (tableName: string) => {
    setSelectedTable(tableName);
    fetchTableData(tableName);
  };

  const getRowKey = (row: Record<string, any>, index: number) => {
    if (tableData?.primaryKey && row.hasOwnProperty(tableData.primaryKey)) {
      return String(row[tableData.primaryKey]);
    }
    return String(index);
  };

  const parseValue = (column: TableColumn, value: string) => {
    if (value === "") return null;
    const typeText = column.type?.toLowerCase() || "";
    if (typeText.includes("int")) {
      const parsed = Number(value);
      return Number.isNaN(parsed) ? value : parsed;
    }
    if (typeText.includes("real") || typeText.includes("float") || typeText.includes("double")) {
      const parsed = Number(value);
      return Number.isNaN(parsed) ? value : parsed;
    }
    if (typeText.includes("bool")) {
      return value === "1" || value.toLowerCase() === "true";
    }
    return value;
  };

  const displayValue = (value: any) => {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  const handleCellChange = (row: Record<string, any>, index: number, column: TableColumn, value: string) => {
    const key = getRowKey(row, index);
    setEditedRows((prev) => {
      const nextRow = { ...(prev[key] ?? row) };
      nextRow[column.name] = parseValue(column, value);
      return { ...prev, [key]: nextRow };
    });
  };

  const handleNewRowChange = (column: TableColumn, value: string) => {
    setNewRowData((prev) => ({
      ...prev,
      [column.name]: parseValue(column, value),
    }));
  };

  const handleSaveRow = async (row: Record<string, any>, index: number) => {
    if (!token || !dbPassword || !tableData?.primaryKey || !selectedTable) {
      setStatusMessage("无法保存：缺少主键信息或未选择表");
      return;
    }
    const primaryKey = tableData.primaryKey;
    const rowKey = getRowKey(row, index);
    const pkValue = row[primaryKey];
    if (pkValue === undefined || pkValue === null) {
      setStatusMessage("该行缺少主键值，无法保存");
      return;
    }
    setSavingRowKey(rowKey);
    try {
      await apiClient(
        `/api/admin/database/tables/${encodeURIComponent(selectedTable)}/rows/${encodeURIComponent(String(pkValue))}`,
        {
          method: "PUT",
          token,
          headers: {
            "X-Database-Password": dbPassword,
          },
          body: JSON.stringify({
            data: editedRows[rowKey] ?? row,
          }),
        },
      );
      setStatusMessage("保存成功");
      setEditedRows((prev) => {
        const next = { ...prev };
        delete next[rowKey];
        return next;
      });
      await fetchTableData(selectedTable);
    } catch (error: any) {
      setStatusMessage(error?.message || "保存失败");
    } finally {
      setSavingRowKey(null);
    }
  };

  const handleDeleteRow = async (row: Record<string, any>, index: number) => {
    if (!token || !dbPassword || !tableData?.primaryKey || !selectedTable) {
      setStatusMessage("无法删除：缺少主键信息或未选择表");
      return;
    }
    const pkValue = row[tableData.primaryKey];
    if (pkValue === undefined || pkValue === null) {
      setStatusMessage("该行缺少主键值，无法删除");
      return;
    }
    if (!window.confirm("确定要删除此记录吗？")) return;
    const rowKey = getRowKey(row, index);
    setDeletingRowKey(rowKey);
    try {
      await apiClient(
        `/api/admin/database/tables/${encodeURIComponent(selectedTable)}/rows/${encodeURIComponent(String(pkValue))}`,
        {
          method: "DELETE",
          token,
          headers: {
            "X-Database-Password": dbPassword,
          },
        },
      );
      setStatusMessage("删除成功");
      await fetchTableData(selectedTable);
    } catch (error: any) {
      setStatusMessage(error?.message || "删除失败");
    } finally {
      setDeletingRowKey(null);
    }
  };

  const handleCreateRow = async () => {
    if (!token || !dbPassword || !selectedTable || !tableData?.columns) {
      setStatusMessage("无法创建：未选择表");
      return;
    }
    const payloadEntries = Object.entries(newRowData).filter(([_, value]) => value !== undefined);
    if (payloadEntries.length === 0) {
      setStatusMessage("请至少填写一个字段");
      return;
    }
    setCreatingRow(true);
    try {
      await apiClient(`/api/admin/database/tables/${encodeURIComponent(selectedTable)}/rows`, {
        method: "POST",
        token,
        headers: {
          "X-Database-Password": dbPassword,
        },
        body: JSON.stringify({
          data: Object.fromEntries(payloadEntries),
        }),
      });
      setStatusMessage("创建成功");
      setShowCreateForm(false);
      setNewRowData({});
      await fetchTableData(selectedTable);
    } catch (error: any) {
      setStatusMessage(error?.message || "创建失败");
    } finally {
      setCreatingRow(false);
    }
  };

  const handleCsvUpload = async () => {
    if (!token || !dbPassword || !selectedTable) {
      setStatusMessage("请选择数据表");
      return;
    }
    if (!csvFile) {
      setStatusMessage("请先选择 CSV 文件");
      return;
    }
    const formData = new FormData();
    formData.append("mode", csvMode);
    formData.append("file", csvFile);
    setUploadingCsv(true);
    try {
      await apiClient(`/api/admin/database/tables/${encodeURIComponent(selectedTable)}/import`, {
        method: "POST",
        token,
        headers: {
          "X-Database-Password": dbPassword,
        },
        body: formData,
      });
      setStatusMessage("CSV 导入成功");
      setCsvFile(null);
      if (csvInputRef.current) {
        csvInputRef.current.value = "";
      }
      await fetchTableData(selectedTable);
    } catch (error: any) {
      setStatusMessage(error?.message || "CSV 导入失败");
    } finally {
      setUploadingCsv(false);
    }
  };

  const handleDeleteTable = async () => {
    if (!token || !dbPassword || !selectedTable) return;
    if (!window.confirm(`确定删除整个表 ${selectedTable} 吗？此操作不可恢复。`)) return;
    setDeletingTable(true);
    try {
      await apiClient(`/api/admin/database/tables/${encodeURIComponent(selectedTable)}`, {
        method: "DELETE",
        token,
        headers: {
          "X-Database-Password": dbPassword,
        },
      });
      setStatusMessage(`已删除表 ${selectedTable}`);
      setSelectedTable(null);
      setTableData(null);
      setEditedRows({});
      setShowCreateForm(false);
      setNewRowData({});
      await fetchTables();
    } catch (error: any) {
      setStatusMessage(error?.message || "删除表失败");
    } finally {
      setDeletingTable(false);
    }
  };

  const hasPrimaryKey = useMemo(() => Boolean(tableData?.primaryKey), [tableData]);

  if (!dbPassword) {
    return (
      <div className="max-w-md mx-auto bg-white shadow rounded p-6">
        <h1 className="text-xl font-semibold mb-4">数据库管理</h1>
        <form className="space-y-4" onSubmit={handleLogin}>
          <div>
            <label htmlFor="dbPassword" className="block text-sm font-medium text-slate-600 mb-1">
              Database 密码
            </label>
            <input
              id="dbPassword"
              type="password"
              value={passwordInput}
              onChange={(event) => setPasswordInput(event.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoFocus
              required
            />
          </div>
          {loginError && <p className="text-sm text-red-600">{loginError}</p>}
          <button
            type="submit"
            className="w-full rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            进入
          </button>
        </form>
        <p className="mt-4 text-xs text-slate-500">直接修改Database是危险的操作，请慎重。</p>
        {/* <p className="mt-4 text-xs text-slate-500">默认密码：admindatabase</p> */}
      </div>
    );
  }

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8">
      <div className="flex gap-6 px-4 sm:px-6 lg:px-8">
        <aside className="w-60 bg-white rounded shadow p-4 space-y-3 sticky top-6 self-start max-h-[calc(100vh-7rem)] overflow-auto">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-semibold">数据表</h2>
          <button className="text-xs text-indigo-600" onClick={fetchTables}>
            刷新
          </button>
        </div>
        {tables.length === 0 ? (
          <p className="text-sm text-slate-500">暂无数据表</p>
        ) : (
          <ul className="space-y-1">
            {tables.map((table) => (
              <li key={table}>
                <button
                  onClick={() => handleSelectTable(table)}
                  className={`w-full text-left px-3 py-2 rounded text-sm ${
                    table === selectedTable ? "bg-indigo-600 text-white" : "hover:bg-slate-100"
                  }`}
                >
                  {table}
                </button>
              </li>
            ))}
          </ul>
        )}
        </aside>
        <section className="flex-1 bg-white rounded shadow p-4 flex flex-col h-[calc(100vh-7rem)] min-h-[60vh] overflow-hidden">
          <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold">表内容</h1>
            {selectedTable && <p className="text-sm text-slate-500 mt-1">{selectedTable}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="text-sm text-indigo-600"
              onClick={() => selectedTable && fetchTableData(selectedTable)}
              disabled={!selectedTable || loadingTable}
            >
              {loadingTable ? "加载中..." : "重新加载"}
            </button>
            {selectedTable && (
              <button
                className="text-sm text-white bg-red-600 rounded px-3 py-1 disabled:opacity-60"
                onClick={handleDeleteTable}
                disabled={deletingTable}
              >
                {deletingTable ? "删除表中..." : "删除表"}
              </button>
            )}
          </div>
        </div>
        {tableError && <p className="text-sm text-red-600 mb-4">{tableError}</p>}
        {statusMessage && <p className="text-sm text-slate-600 mb-4">{statusMessage}</p>}
        {!selectedTable && <p className="text-sm text-slate-500">请选择左侧的数据表</p>}
        {selectedTable && loadingTable && <p className="text-sm text-slate-500">加载中...</p>}
          {selectedTable && !loadingTable && tableData && (
            <>
              {!hasPrimaryKey && (
                <p className="mb-4 text-sm text-amber-600">该表没有主键，当前只允许新增和查看。</p>
              )}
              <div className="mb-4">
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                    onClick={() => {
                      setShowCreateForm((prev) => !prev);
                      if (showCsvForm) setShowCsvForm(false);
                    }}
                  >
                    {showCreateForm ? "取消新增" : "新增记录"}
                  </button>
                  <button
                    type="button"
                    className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                    onClick={() => {
                      setShowCsvForm((prev) => !prev);
                      if (showCreateForm) setShowCreateForm(false);
                    }}
                  >
                    {showCsvForm ? "取消上传" : "上传 CSV"}
                  </button>
                </div>
                {showCreateForm && (
                  <div className="mt-3 space-y-3 border rounded p-3 bg-slate-50">
                    <div className="grid md:grid-cols-2 gap-3">
                      {tableData.columns.map((column) => (
                        <label key={column.name} className="text-sm text-slate-600">
                          {column.name}
                          <input
                            type="text"
                            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            value={displayValue(newRowData[column.name])}
                            onChange={(event) => handleNewRowChange(column, event.target.value)}
                          />
                        </label>
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="rounded bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                        onClick={handleCreateRow}
                        disabled={creatingRow}
                      >
                        {creatingRow ? "创建中..." : "创建"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {showCsvForm && (
                <div className="mb-4 border rounded p-3 bg-slate-50">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-base font-semibold">上传 CSV</h2>
                      <p className="text-xs text-slate-500">CSV 表头需与当前表字段完全一致</p>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="radio"
                          name="csv-mode"
                          value="overwrite"
                          checked={csvMode === "overwrite"}
                          onChange={() => setCsvMode("overwrite")}
                        />
                        覆盖导入
                      </label>
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="radio"
                          name="csv-mode"
                          value="append"
                          checked={csvMode === "append"}
                          onChange={() => setCsvMode("append")}
                        />
                        后缀导入
                      </label>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <input
                      ref={csvInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleCsvFileChange}
                      className="text-sm"
                    />
                    <button
                      type="button"
                      className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 md:ml-auto md:self-end"
                      onClick={handleCsvUpload}
                      disabled={uploadingCsv}
                    >
                      {uploadingCsv ? "上传中..." : "开始上传"}
                    </button>
                  </div>
                </div>
              )}
              <div className="flex-1 overflow-auto border rounded">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {tableData.columns.map((column) => (
                      <th key={column.name} className="px-3 py-2 text-left font-semibold text-slate-600 bg-slate-50 sticky top-0">
                        {column.name}
                        <span className="ml-2 text-xs text-slate-400">{column.type}</span>
                      </th>
                    ))}
                    {hasPrimaryKey && (
                      <th className="px-3 py-2 text-left font-semibold text-slate-600 bg-slate-50 sticky top-0">
                        操作
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {tableData.rows.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-center text-slate-500" colSpan={tableData.columns.length + 1}>
                        暂无数据
                      </td>
                    </tr>
                  ) : (
                    tableData.rows.map((row, rowIndex) => {
                      const rowKey = getRowKey(row, rowIndex);
                      return (
                        <tr key={rowKey} className="border-t">
                          {tableData.columns.map((column) => {
                            const value =
                              editedRows[rowKey]?.[column.name] ?? row[column.name];
                            return (
                              <td key={column.name} className="px-3 py-2 align-top">
                                {hasPrimaryKey ? (
                                  <input
                                    type="text"
                                    value={displayValue(value)}
                                    onChange={(event) =>
                                      handleCellChange(row, rowIndex, column, event.target.value)
                                    }
                                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  />
                                ) : (
                                  <span className="text-slate-700">{displayValue(value) || "-"}</span>
                                )}
                              </td>
                            );
                          })}
                          {hasPrimaryKey && (
                            <td className="px-3 py-2">
                              <div className="flex gap-2">
                                <button
                                  className="text-sm text-white bg-indigo-600 rounded px-3 py-1 disabled:opacity-60"
                                  onClick={() => handleSaveRow(row, rowIndex)}
                                  disabled={savingRowKey === rowKey}
                                >
                                  {savingRowKey === rowKey ? "保存中..." : "保存"}
                                </button>
                                <button
                                  className="text-sm text-white bg-red-600 rounded px-3 py-1 disabled:opacity-60"
                                  onClick={() => handleDeleteRow(row, rowIndex)}
                                  disabled={deletingRowKey === rowKey}
                                >
                                  {deletingRowKey === rowKey ? "删除中..." : "删除"}
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default AdminDatabasePage;
