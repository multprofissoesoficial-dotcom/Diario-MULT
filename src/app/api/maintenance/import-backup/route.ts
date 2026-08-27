import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const backupData = await req.json();

    const report: Record<string, { total: number; inserted: number; errors: number }> = {
      franquias: { total: 0, inserted: 0, errors: 0 },
      courses: { total: 0, inserted: 0, errors: 0 },
      users: { total: 0, inserted: 0, errors: 0 },
      missions: { total: 0, inserted: 0, errors: 0 },
      companies: { total: 0, inserted: 0, errors: 0 },
      job_postings: { total: 0, inserted: 0, errors: 0 },
      applications: { total: 0, inserted: 0, errors: 0 },
    };

    // 1. Importar Franquias
    if (backupData.franquias?.length) {
      report.franquias.total = backupData.franquias.length;
      const rows = backupData.franquias.map((f: any) => ({
        id: f._id || f.id,
        nome: f.nome || "Unidade",
        cidade: f.cidade || null,
        created_at: f.createdAt || new Date().toISOString(),
      }));
      const { error } = await supabaseAdmin.from("franquias").upsert(rows);
      if (error) report.franquias.errors += rows.length;
      else report.franquias.inserted += rows.length;
    }

    // 2. Importar Cursos
    if (backupData.courses?.length) {
      report.courses.total = backupData.courses.length;
      const rows = backupData.courses.map((c: any) => ({
        id: c._id || c.id,
        title: c.title || "Curso",
        description: c.description || null,
        badges: c.badges || [],
        created_at: c.createdAt || new Date().toISOString(),
      }));
      const { error } = await supabaseAdmin.from("cursos").upsert(rows);
      if (error) report.courses.errors += rows.length;
      else report.courses.inserted += rows.length;
    }

    // 3. Importar Usuários / Perfis
    if (backupData.users?.length) {
      report.users.total = backupData.users.length;
      const rows = backupData.users.map((u: any) => ({
        id: u._id || u.id,
        email: u.email ? u.email.toLowerCase().trim() : `${u.codigo || u._id}@mult.com.br`,
        display_name: u.displayName || u.nome || "Aluno",
        codigo: u.codigo || null,
        role: u.role || "aluno",
        franquia_id: u.franquiaId || null,
        turma: u.turma || null,
        xp: Number(u.xp) || 0,
        skills: u.skills || [],
        resume_url: u.resumeUrl || null,
        availability_status: u.availabilityStatus || "Disponível",
        withdrawal_reason: u.withdrawalReason || null,
        unlocked_badges: u.unlockedBadges || [],
        current_course_id: u.currentCourseId || "INF",
        ats_terms_accepted: Boolean(u.atsTermsAccepted),
        ats_terms_accepted_at: u.atsTermsAcceptedAt || null,
        perceptions: u.perceptions || {},
        employment_history: u.employmentHistory || [],
        created_at: u.createdAt || new Date().toISOString(),
        last_login: u.lastLogin || null,
      }));

      // Inserção em lotes de 200
      for (let i = 0; i < rows.length; i += 200) {
        const batch = rows.slice(i, i + 200);
        const { error } = await supabaseAdmin.from("usuarios").upsert(batch);
        if (error) {
          console.error("Erro no lote de usuários:", error);
          report.users.errors += batch.length;
        } else {
          report.users.inserted += batch.length;
        }
      }
    }

    // 4. Importar Missões
    if (backupData.missions?.length) {
      report.missions.total = backupData.missions.length;
      const rows = backupData.missions.map((m: any) => ({
        legacy_id: m._id || m.id,
        student_id: m.studentId,
        student_name: m.studentName || null,
        franquia_id: m.franquiaId || null,
        turma: m.turma || null,
        course_id: m.courseId || null,
        course_name: m.courseName || null,
        module: m.module || "Geral",
        class_num: Number(m.classNum) || 1,
        content: m.content || "",
        status: m.status || "pending",
        ai_feedback: m.aiFeedback || null,
        xp_awarded: Number(m.xpAwarded) || 0,
        created_at: m.createdAt || new Date().toISOString(),
        approved_at: m.approvedAt || null,
      }));

      for (let i = 0; i < rows.length; i += 200) {
        const batch = rows.slice(i, i + 200);
        const { error } = await supabaseAdmin.from("missoes").upsert(batch, { onConflict: "legacy_id" });
        if (error) {
          console.error("Erro no lote de missões:", error);
          report.missions.errors += batch.length;
        } else {
          report.missions.inserted += batch.length;
        }
      }
    }

    // 5. Importar Empresas
    const companyIdMap: Record<string, string> = {};
    if (backupData.companies?.length) {
      report.companies.total = backupData.companies.length;
      for (const c of backupData.companies) {
        const { data, error } = await supabaseAdmin.from("empresas").upsert({
          legacy_id: c._id || c.id,
          name: c.name,
          contact_person: c.contactPerson || null,
          phone: c.phone || null,
          franquia_id: c.franquiaId || null,
          created_at: c.createdAt || new Date().toISOString(),
        }, { onConflict: "legacy_id" }).select("id, legacy_id").single();

        if (data) {
          companyIdMap[c._id || c.id] = data.id;
          report.companies.inserted++;
        } else {
          report.companies.errors++;
        }
      }
    }

    // 6. Importar Vagas
    const jobIdMap: Record<string, string> = {};
    if (backupData.job_postings?.length) {
      report.job_postings.total = backupData.job_postings.length;
      for (const j of backupData.job_postings) {
        const mappedCompanyId = companyIdMap[j.companyId] || null;
        const { data, error } = await supabaseAdmin.from("vagas").upsert({
          legacy_id: j._id || j.id,
          title: j.title,
          company_id: mappedCompanyId,
          company_name: j.companyName || "Empresa Parceira",
          franquia_id: j.franquiaId || null,
          description: j.description || "",
          required_skills: j.requiredSkills || [],
          status: j.status || "aberta",
          opening_date: j.openingDate || null,
          closing_forecast: j.closingForecast || null,
          selection_process_type: j.selectionProcessType || "Entrevista Presencial",
          created_at: j.createdAt || new Date().toISOString(),
        }, { onConflict: "legacy_id" }).select("id, legacy_id").single();

        if (data) {
          jobIdMap[j._id || j.id] = data.id;
          report.job_postings.inserted++;
        } else {
          report.job_postings.errors++;
        }
      }
    }

    // 7. Importar Candidaturas
    if (backupData.applications?.length) {
      report.applications.total = backupData.applications.length;
      for (const a of backupData.applications) {
        const mappedJobId = jobIdMap[a.jobId] || null;
        if (!mappedJobId) {
          report.applications.errors++;
          continue;
        }

        const { error } = await supabaseAdmin.from("candidaturas").upsert({
          legacy_id: a._id || a.id,
          job_id: mappedJobId,
          student_id: a.studentId,
          match_score: Number(a.matchScore) || 0,
          status: a.status || "pendente",
          status_history: a.statusHistory || [],
          applied_at: a.appliedAt || new Date().toISOString(),
        }, { onConflict: "legacy_id" });

        if (error) report.applications.errors++;
        else report.applications.inserted++;
      }
    }

    return NextResponse.json({
      success: true,
      message: "Migração de dados para o Supabase concluída com sucesso!",
      report,
    });
  } catch (error: any) {
    console.error("Erro crítico na importação:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
