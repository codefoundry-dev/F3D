-- CreateTable
CREATE TABLE "user_table_views" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "table_name" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "visible_columns" TEXT[],
    "column_order" TEXT[],
    "sort_by" VARCHAR(100),
    "sort_dir" VARCHAR(4),
    "quick_filter" VARCHAR(100),
    "group_by" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_table_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_user_table_views_user_table" ON "user_table_views"("user_id", "table_name");

-- AddForeignKey
ALTER TABLE "user_table_views" ADD CONSTRAINT "user_table_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
