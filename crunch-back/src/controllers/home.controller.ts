import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { ok, serverError } from '../lib/response'
import { CATEGORY_LABEL } from '../lib/contains'

const CATEGORY_META = [
  { key: 'DEV', icon: '💻', label: '개발·IT', bg: '#FFF0E8' },
  { key: 'DESIGN', icon: '🎨', label: '디자인', bg: '#EAF3DE' },
  { key: 'MARKETING', icon: '📱', label: '마케팅', bg: '#E6F1FB' },
  { key: 'WRITING', icon: '✍️', label: '글쓰기·번역', bg: '#FAEEDA' },
  { key: 'VIDEO', icon: '🎬', label: '영상·사진', bg: '#FBEAF0' },
  { key: 'MUSIC', icon: '🎵', label: '음악·오디오', bg: '#E1F5EE' },
]

export async function getHomeSummary(_req: Request, res: Response): Promise<void> {
  try {
    const [
      freelancerCount,
      activeFreelancerCount,
      completedOrderCount,
      completedProjectCount,
      serviceCount,
      avgReview,
      onTimeOrderCount,
      totalDoneOrderCount,
      categoryRows,
      topFreelancers,
      reviews,
    ] = await Promise.all([
      prisma.freelancer.count(),
      prisma.freelancer.count({ where: { online: true } }),
      prisma.order.count({ where: { status: 'DONE' } }),
      prisma.project.count({ where: { status: 'DONE' } }),
      prisma.service.count({ where: { isActive: true, approvalStatus: 'APPROVED' } }),
      prisma.review.aggregate({ _avg: { rating: true } }),
      prisma.order.count({ where: { status: 'DONE', completedAt: { not: null } } }),
      prisma.order.count({ where: { status: 'DONE' } }),
      prisma.service.groupBy({
        by: ['category'],
        where: { isActive: true, approvalStatus: 'APPROVED' },
        _count: { _all: true },
      }),
      prisma.freelancer.findMany({
        orderBy: [
          { rating: 'desc' },
          { completedJobs: 'desc' },
        ],
        take: 4,
        select: {
          id: true,
          role: true,
          badge: true,
          rating: true,
          completedJobs: true,
          hourlyRate: true,
          online: true,
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
      prisma.review.findMany({
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: {
          id: true,
          rating: true,
          comment: true,
          reviewer: { select: { name: true, avatarUrl: true } },
          order: {
            select: {
              service: { select: { title: true } },
            },
          },
        },
      }),
    ])

    const categoryCountMap = new Map(
      categoryRows.map(row => [row.category, row._count._all]),
    )

    ok(res, {
      stats: {
        freelancers: freelancerCount,
        activeFreelancers: activeFreelancerCount,
        completedProjects: completedOrderCount + completedProjectCount,
        averageRating: Number((avgReview._avg.rating ?? 0).toFixed(1)),
        onTimeRate: totalDoneOrderCount > 0
          ? Math.round((onTimeOrderCount / totalDoneOrderCount) * 100)
          : 0,
      },
      categories: CATEGORY_META.map(category => ({
        icon: category.icon,
        label: category.label,
        bg: category.bg,
        count: categoryCountMap.get(category.key as any) ?? 0,
      })),
      topFreelancers: topFreelancers.map(item => ({
        id: item.id,
        userId: item.user.id,
        name: item.user.name,
        avatarUrl: item.user.avatarUrl,
        role: item.role,
        badge: item.badge,
        rating: item.rating,
        completedJobs: item.completedJobs,
        hourlyRate: item.hourlyRate,
        online: item.online,
      })),
      reviews: reviews
        .filter(review => review.comment)
        .map(review => ({
          id: review.id,
          stars: review.rating,
          text: review.comment,
          name: review.reviewer.name,
          role: review.order?.service?.title ?? '서비스 이용자',
          avatarUrl: review.reviewer.avatarUrl,
        })),
      totals: {
        services: serviceCount,
      },
      categoryLabels: CATEGORY_LABEL,
    })
  } catch (err) {
    console.error('[getHomeSummary]', err)
    serverError(res)
  }
}
