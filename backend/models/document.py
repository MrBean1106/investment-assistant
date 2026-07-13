"""Document model — stores uploaded & parsed (incl. OCR) file content.

Linked with the OCR feature: every file uploaded through /api/files/upload
is persisted here with its extracted text and whether OCR was required.
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, func
from database import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    filename = Column(String(255), nullable=False, comment="原始文件名")
    file_type = Column(String(20), comment="text / pdf / image")
    ext = Column(String(10), comment="扩展名")
    content = Column(Text, comment="提取出的文本（扫描件为 OCR 结果）")
    ocr_used = Column(Boolean, default=False, comment="是否使用了 OCR")
    ocr_engine = Column(String(50), comment="使用的 OCR 引擎名称")
    size = Column(Integer, comment="原始文件字节数")
    created_at = Column(DateTime, server_default=func.now(), comment="入库时间")
    # ── 企业附件关联 ──
    enterprise_id = Column(Integer, index=True, comment="关联企业 id（过程文件附件）")
    stored_name = Column(String(255), comment="磁盘存储文件名（用于原始文件下载）")
    note = Column(String(255), comment="附件备注（如：BP、尽调报告）")
